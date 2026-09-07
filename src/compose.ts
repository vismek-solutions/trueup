import { discoverFiles, readSource, type DiscoverFilesOptions } from "./adapters/node-files.ts";
import { parseModule, readMentions } from "./adapters/oxc-parse.ts";
import { createResolver } from "./adapters/oxc-resolve.ts";
import { boundaryClaim, boundaryZoneReferences, type BoundaryRule } from "./claims/boundary.ts";
import { completenessClaims } from "./claims/completeness.ts";
import { colocationClaim, testOnlyExportClaim } from "./claims/colocation.ts";
import { customClaims, type Rule } from "./claims/custom.ts";
import { runDelegated } from "./claims/delegated.ts";
import { directoryClaim } from "./claims/directories.ts";
import type { Claim } from "./claims/model.ts";
import { resolutionClaims } from "./claims/resolution.ts";
import { runClaims } from "./claims/run.ts";
import { seamClaim, seamZoneReferences, type SeamRule } from "./claims/seam.ts";
import { zoneReferencesExistClaim } from "./claims/zone-references.ts";
import { buildSymbolGraph } from "./graph/build.ts";
import type { SymbolGraph } from "./graph/model.ts";
import { buildLexicon } from "./lexicon/build.ts";
import type { ModuleRecord, ParseModule } from "./ports/module-record.ts";
import type { Runner } from "./ports/runner.ts";
import { buildProject } from "./project/build.ts";
import type { Project } from "./project/model.ts";
import type { Report } from "./report/model.ts";
import { assignZones } from "./zones/assign.ts";
import type { ZoneDefinition, ZoneRole } from "./zones/model.ts";

export type Overlay = ReadonlyMap<string, string>;

const NO_OVERLAY: Overlay = new Map();

const readSources = (options: DiscoverFilesOptions, overlay: Overlay = NO_OVERLAY): Map<string, string> => {
  const paths = [...new Set([...discoverFiles(options), ...overlay.keys()])].sort();
  return new Map(paths.map((path) => [path, overlay.get(path) ?? readSource(path)]));
};

const parseAll = (sources: ReadonlyMap<string, string>, parse: ParseModule): ModuleRecord[] =>
  [...sources].map(([path, text]) => parse(path, text));

export function analyze(options: DiscoverFilesOptions): SymbolGraph {
  return buildSymbolGraph({
    modules: parseAll(readSources(options), parseModule),
    resolve: createResolver(),
  });
}

export interface InspectOptions {
  readonly root: string;
  readonly roots?: readonly string[] | undefined;
  readonly zones: readonly ZoneDefinition[];
  readonly extensions?: readonly string[] | undefined;
  readonly ignoreDirectories?: readonly string[] | undefined;
  readonly overlay?: Overlay | undefined;
}

const analyseProject = ({ root, roots, zones, extensions, ignoreDirectories, overlay }: InspectOptions) => {
  const sources = readSources({ roots: roots ?? [root], extensions, ignoreDirectories }, overlay);
  const modules = parseAll(sources, parseModule);
  const graph = buildSymbolGraph({ modules, resolve: createResolver() });
  const assignment = assignZones({ root, files: [...graph.files], zones });
  const lexicon = buildLexicon({ modules, sources, readMentions });

  return {
    graph,
    zones: assignment,
    lexicon,
    project: buildProject({ root, graph, zones: assignment, lexicon }),
  };
};

export const inspect = (options: InspectOptions): Project => analyseProject(options).project;

export interface CheckOptions {
  readonly root: string;
  readonly roots?: readonly string[] | undefined;
  readonly zones: readonly ZoneDefinition[];
  readonly boundaries?: readonly BoundaryRule[] | undefined;
  readonly seams?: readonly SeamRule[] | undefined;
  readonly maxFilesPerDirectory?: number | undefined;
  readonly colocation?: boolean | undefined;
  readonly rules?: readonly Rule[] | undefined;
  readonly runners?: readonly Runner[] | undefined;
  readonly overlay?: Overlay | undefined;
  readonly extensions?: readonly string[] | undefined;
  readonly ignoreDirectories?: readonly string[] | undefined;
}

export const standardClaims: readonly Claim[] = [...resolutionClaims, ...completenessClaims];

const namesOf = (zones: readonly ZoneDefinition[], role: ZoneRole): string[] =>
  zones.filter((zone) => zone.role === role).map((zone) => zone.name);

const placementClaims = (zones: readonly ZoneDefinition[]): Claim[] => {
  const tests = namesOf(zones, "tests");
  return [
    colocationClaim([...namesOf(zones, "wiring"), ...tests]),
    ...(tests.length === 0 ? [] : [testOnlyExportClaim(tests)]),
  ];
};

export function check({
  root,
  roots,
  zones,
  boundaries = [],
  seams = [],
  maxFilesPerDirectory,
  colocation = false,
  rules = [],
  runners = [],
  overlay,
  extensions,
  ignoreDirectories,
}: CheckOptions): Report {
  const {
    graph,
    zones: assignment,
    lexicon,
    project,
  } = analyseProject({
    root,
    roots,
    zones,
    extensions,
    ignoreDirectories,
    overlay,
  });

  const claims = [
    ...standardClaims,
    zoneReferencesExistClaim([...boundaryZoneReferences(boundaries), ...seamZoneReferences(seams)]),
    boundaryClaim(boundaries),
    seamClaim(seams),
    ...(maxFilesPerDirectory === undefined ? [] : [directoryClaim(maxFilesPerDirectory)]),
    ...(colocation ? placementClaims(zones) : []),
    ...customClaims(rules),
  ];

  const report = runClaims(claims, { root, graph, zones: assignment, lexicon, project });
  return { claims: [...report.claims, ...runDelegated(runners, root)], coverage: report.coverage };
}
