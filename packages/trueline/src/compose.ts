import { discoverFiles, readSource, type DiscoverFilesOptions } from "./adapters/node-files.ts";
import { parseModule, readDeclarations, readMentions } from "./adapters/oxc-parse.ts";
import { createResolver } from "./adapters/oxc-resolve.ts";
import { boundaryClaim, boundaryZoneReferences, type BoundaryRule } from "./claims/boundary.ts";
import { completenessClaims } from "./claims/completeness.ts";
import { colocationClaim, testOnlyExportClaim } from "./claims/placement/colocation.ts";
import { cycleClaim } from "./claims/cycles.ts";
import { customClaims, type Rule } from "./claims/custom.ts";
import { runDelegated } from "./claims/delegated.ts";
import { directoryClaim, type DirectoryLimit } from "./claims/placement/directories.ts";
import { duplicationClaim } from "./claims/placement/duplication.ts";
import { isolationClaim, type IsolationRule } from "./claims/isolation.ts";
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
import { withoutDuplicates, type Report } from "./report/model.ts";
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

export interface AnalyzeOptions extends DiscoverFilesOptions {
  readonly externals?: readonly string[] | undefined;
}

export function analyze(options: AnalyzeOptions): SymbolGraph {
  return buildSymbolGraph({
    modules: parseAll(readSources(options), parseModule),
    resolve: createResolver({ externals: options.externals }),
  });
}

export interface InspectOptions {
  readonly root: string;
  readonly roots?: readonly string[] | undefined;
  readonly zones: readonly ZoneDefinition[];
  readonly extensions?: readonly string[] | undefined;
  readonly externals?: readonly string[] | undefined;
  readonly ignoreDirectories?: readonly string[] | undefined;
  readonly ignoreFiles?: readonly string[] | undefined;
  readonly overlay?: Overlay | undefined;
}

const analyseProject = ({
  root,
  roots,
  zones,
  extensions,
  externals,
  ignoreDirectories,
  ignoreFiles,
  overlay,
}: InspectOptions) => {
  const discovery = { roots: roots ?? [root], extensions, ignoreDirectories, ignoreFiles };
  const sources = readSources(discovery, overlay);
  const modules = parseAll(sources, parseModule);
  const graph = buildSymbolGraph({ modules, resolve: createResolver({ externals }) });
  const assignment = assignZones({ root, files: [...graph.files], zones });
  const lexicon = buildLexicon({ modules, sources, readMentions, readDeclarations });

  return {
    graph,
    zones: assignment,
    lexicon,
    project: buildProject({ root, graph, zones: assignment, lexicon }),
  };
};

export const inspect = (options: InspectOptions): Project => analyseProject(options).project;

export interface PlacementInput {
  readonly root: string;
  readonly path: string;
  readonly zones: readonly ZoneDefinition[];
  readonly boundaries: readonly BoundaryRule[];
}

export interface Placement {
  readonly zone: string | null;
  readonly mayReach: readonly string[];
  readonly mayNotReach: readonly string[];
}

export function placementOf({ root, path, zones, boundaries }: PlacementInput): Placement {
  const zone = assignZones({ root, files: [path], zones }).zoneOf(path);
  if (zone === null) return { zone: null, mayReach: [], mayNotReach: [] };

  const rules = boundaries.filter((rule) => rule.from === zone);
  const names = zones.map((entry) => entry.name);
  const mayReach = names.filter((name) => name === zone || rules.every((rule) => rule.allow.includes(name)));

  return { zone, mayReach, mayNotReach: names.filter((name) => !mayReach.includes(name)) };
}

export interface CheckOptions {
  readonly root: string;
  readonly roots?: readonly string[] | undefined;
  readonly zones: readonly ZoneDefinition[];
  readonly boundaries?: readonly BoundaryRule[] | undefined;
  readonly seams?: readonly SeamRule[] | undefined;
  readonly isolate?: readonly IsolationRule[] | undefined;
  readonly maxFilesPerDirectory?: number | undefined;
  readonly directoryLimits?: readonly DirectoryLimit[] | undefined;
  readonly duplication?: number | undefined;
  readonly colocation?: boolean | undefined;
  readonly rules?: readonly Rule[] | undefined;
  readonly runners?: readonly Runner[] | undefined;
  readonly overlay?: Overlay | undefined;
  readonly extensions?: readonly string[] | undefined;
  readonly externals?: readonly string[] | undefined;
  readonly ignoreDirectories?: readonly string[] | undefined;
  readonly ignoreFiles?: readonly string[] | undefined;
}

const standardClaims: readonly Claim[] = [...resolutionClaims, ...completenessClaims];

const namesOf = (zones: readonly ZoneDefinition[], role: ZoneRole): string[] =>
  zones.filter((zone) => zone.role === role).map((zone) => zone.name);

const placementClaims = (zones: readonly ZoneDefinition[]): Claim[] => {
  const testZones = namesOf(zones, "tests");
  const apiZones = namesOf(zones, "api");

  return [
    colocationClaim([...namesOf(zones, "wiring"), ...testZones, ...apiZones]),
    ...(testZones.length === 0 ? [] : [testOnlyExportClaim({ testZones, apiZones })]),
  ];
};

export function check({
  root,
  roots,
  zones,
  boundaries = [],
  seams = [],
  isolate = [],
  maxFilesPerDirectory,
  directoryLimits,
  duplication,
  colocation = false,
  rules = [],
  runners = [],
  overlay,
  extensions,
  externals,
  ignoreDirectories,
  ignoreFiles,
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
    externals,
    ignoreDirectories,
    ignoreFiles,
    overlay,
  });

  const claims = [
    ...standardClaims,
    zoneReferencesExistClaim([...boundaryZoneReferences(boundaries), ...seamZoneReferences(seams)]),
    boundaryClaim(boundaries),
    seamClaim(seams),
    cycleClaim,
    ...(isolate.length === 0 ? [] : [isolationClaim(isolate)]),
    ...(maxFilesPerDirectory === undefined && (directoryLimits ?? []).length === 0
      ? []
      : [directoryClaim(maxFilesPerDirectory ?? Number.POSITIVE_INFINITY, directoryLimits ?? [])]),
    ...(duplication === undefined ? [] : [duplicationClaim(duplication)]),
    ...(colocation ? placementClaims(zones) : []),
    ...customClaims(rules),
  ];

  const report = runClaims(claims, { root, graph, zones: assignment, lexicon, project });
  return {
    claims: withoutDuplicates([...report.claims, ...runDelegated(runners, root)]),
    coverage: report.coverage,
  };
}
