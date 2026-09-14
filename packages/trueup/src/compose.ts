import { gitChanges } from "./adapters/git/changes.ts";
import { readSets, readSources, type DiscoverFilesOptions } from "./adapters/node-files.ts";
import { parseModule, readDeclarations, readMentions } from "./adapters/oxc-parse.ts";
import { createResolver } from "./adapters/oxc-resolve.ts";
import { apiSurfaceClaim, type ApiSurface } from "./claims/members/api-surface.ts";
import {
  boundaryClaim,
  boundaryZoneReferences,
  reachedBy,
  sharedHomes,
  type BoundaryRule,
} from "./claims/boundary.ts";
import { completenessClaims } from "./claims/completeness.ts";
import { colocationClaim } from "./claims/placement/colocation.ts";
import { testInternalsClaim, testOnlyExportClaim } from "./claims/placement/test-surface.ts";
import { cycleClaim } from "./claims/cycles.ts";
import { customClaims } from "./claims/custom.ts";
import { runDelegated } from "./claims/delegated.ts";
import { grantClaim, type MemberGrants } from "./claims/members/grants.ts";
import { directoryClaim, type DirectoryLimit } from "./claims/placement/directories.ts";
import { duplicationClaim } from "./claims/placement/duplication.ts";
import { readershipClaim } from "./claims/placement/readership.ts";
import { reviewClaim, sizeOf, type ChangeSize, type ReviewBudget } from "./claims/review/budget.ts";
import {
  isolationClaim,
  loosePlacementClaim,
  siblingsFor,
  type IsolationRule,
  type SiblingPlacement,
  type SiblingsInput,
} from "./claims/isolation/siblings.ts";
import type { Claim } from "./claims/model.ts";
import { resolutionClaims } from "./claims/resolution.ts";
import { runClaims } from "./claims/run.ts";
import { seamClaim, seamZoneReferences } from "./claims/seam.ts";
import { ungovernedFlows, type Ungoverned } from "./claims/ungoverned.ts";
import { zoneReferencesExistClaim } from "./claims/zone-references.ts";
import type { Settings } from "./config/model.ts";
import { buildSymbolGraph } from "./graph/build.ts";
import type { SymbolGraph } from "./graph/model.ts";
import { buildLexicon } from "./lexicon/build.ts";
import type { FileChange } from "./ports/changes.ts";
import type { ModuleRecord, ParseModule } from "./ports/module-record.ts";
import { buildProject } from "./project/build.ts";
import type { Project } from "./project/model.ts";
import { aboutName, type NameReport } from "./project/name.ts";
import { withoutDuplicates, type Report } from "./report/model.ts";
import { assignZones } from "./zones/assign.ts";
import type { ZoneDefinition, ZoneRole } from "./zones/model.ts";

export type Overlay = ReadonlyMap<string, string>;

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
  readonly assets?: readonly string[] | undefined;
  readonly overlay?: Overlay | undefined;
}

const analyseProject = (options: InspectOptions) => {
  const { root, roots, zones, extensions, externals, ignoreDirectories, ignoreFiles, overlay } = options;
  const roughly = { roots: roots ?? [root], extensions, ignoreDirectories, ignoreFiles };
  // an asset is never parsed, never in the graph and never zoned, so a stylesheet owes no zone
  const { sources, assets } = readSets({ root, ...roughly, assets: options.assets }, overlay);
  const modules = parseAll(sources, parseModule);
  const graph = buildSymbolGraph({ modules, resolve: createResolver({ externals }) });
  const assignment = assignZones({ root, files: [...graph.files], zones });
  const lexicon = buildLexicon({ modules, sources, readMentions, readDeclarations });

  return {
    graph,
    zones: assignment,
    lexicon,
    project: buildProject({ root, graph, zones: assignment, lexicon, sources, assets }),
  };
};

export const inspect = (options: InspectOptions): Project => analyseProject(options).project;

export const ungovernedIn = (project: Project, boundaries: readonly BoundaryRule[]): Ungoverned =>
  ungovernedFlows(project, boundaries);

export const nameIn = (project: Project, file: string, name: string): NameReport =>
  aboutName(project, file, name);

export const siblingsIn = (input: SiblingsInput): readonly SiblingPlacement[] => siblingsFor(input);

export const changeSizeIn = (changed: readonly FileChange[], budget: ReviewBudget): ChangeSize =>
  sizeOf(changed, budget);

export interface PlacementInput {
  readonly root: string;
  readonly path: string;
  readonly zones: readonly ZoneDefinition[];
  readonly boundaries: readonly BoundaryRule[];
}

export interface Reach {
  readonly mayReach: readonly string[];
  readonly mayNotReach: readonly string[];
}

export interface Placement extends Reach {
  readonly zone: string | null;
}

export interface ReachInput {
  readonly zone: string;
  readonly zones: readonly ZoneDefinition[];
  readonly boundaries: readonly BoundaryRule[];
}

export function reachOf({ zone, zones, boundaries }: ReachInput): Reach {
  const names = zones.map((entry) => entry.name);
  const mayReach = reachedBy(zone, { names, rules: boundaries });

  return { mayReach, mayNotReach: names.filter((name) => !mayReach.includes(name)) };
}

export type Rulebook = Omit<ReachInput, "zone">;

export interface HomesInput extends Rulebook {
  readonly needs: readonly string[];
  readonly readers: readonly string[];
}

export const homesFor = ({ needs, readers, zones, boundaries }: HomesInput): readonly string[] =>
  sharedHomes({ needs, readers, names: zones.map((entry) => entry.name), rules: boundaries });

export function placementOf({ root, path, zones, boundaries }: PlacementInput): Placement {
  const zone = assignZones({ root, files: [path], zones }).zoneOf(path);
  if (zone === null) return { zone: null, mayReach: [], mayNotReach: [] };

  return { zone, ...reachOf({ zone, zones, boundaries }) };
}

export interface CheckOptions extends Settings {
  readonly root: string;
  readonly roots?: readonly string[] | undefined;
  readonly zones: readonly ZoneDefinition[];
  readonly directoryLimits?: readonly DirectoryLimit[] | undefined;
  readonly apiSurfaces?: readonly ApiSurface[] | undefined;
  readonly grants?: readonly MemberGrants[] | undefined;
  readonly overlay?: Overlay | undefined;
  readonly ignoreFiles?: readonly string[] | undefined;
}

const standardClaims: readonly Claim[] = [...resolutionClaims, ...completenessClaims];

const namesOf = (zones: readonly ZoneDefinition[], role: ZoneRole): string[] =>
  zones.filter((zone) => zone.role === role).map((zone) => zone.name);

const roleZonesIn = (zones: readonly ZoneDefinition[]): string[] => [
  ...namesOf(zones, "wiring"),
  ...namesOf(zones, "tests"),
  ...namesOf(zones, "api"),
];

const placementClaims = (zones: readonly ZoneDefinition[]): Claim[] => {
  const testZones = namesOf(zones, "tests");
  const apiZones = namesOf(zones, "api");

  return [
    colocationClaim(roleZonesIn(zones)),
    ...(testZones.length === 0 ? [] : [testOnlyExportClaim({ testZones, apiZones })]),
  ];
};

const isolationClaims = (isolate: readonly IsolationRule[]): Claim[] =>
  isolate.length === 0
    ? []
    : [
        isolationClaim(isolate),
        ...(isolate.some((rule) => rule.wiring !== undefined) ? [loosePlacementClaim(isolate)] : []),
      ];

const under = <T extends object>(setting: string, claims: readonly T[]): T[] =>
  claims.map((claim) => ({ ...claim, setting }));

const directoryClaims = (max: number | undefined, limits: readonly DirectoryLimit[]): Claim[] =>
  max === undefined && limits.length === 0 ? [] : [directoryClaim(max ?? Number.POSITIVE_INFINITY, limits)];

const duplicationClaims = (minSize: number | undefined, boundaries: readonly BoundaryRule[]): Claim[] =>
  minSize === undefined ? [] : [duplicationClaim({ minSize, boundaries })];

const internalsFor = (zones: readonly ZoneDefinition[]): Claim =>
  testInternalsClaim({
    testZones: namesOf(zones, "tests"),
    apiZones: namesOf(zones, "api"),
    wiringZones: namesOf(zones, "wiring"),
  });

const claimsFor = (options: CheckOptions): Claim[] => {
  const { zones, boundaries = [], seams = [], isolate = [], rules = [] } = options;
  const { maxFilesPerDirectory, directoryLimits = [], apiSurfaces = [], grants = [] } = options;
  const { duplication, reviewable, colocation, readerships, testInternals } = options;
  const { changes = gitChanges() } = options;

  return [
    ...standardClaims,
    zoneReferencesExistClaim([...boundaryZoneReferences(boundaries), ...seamZoneReferences(seams)]),
    ...under("boundaries", [boundaryClaim(boundaries)]),
    ...under("seams", [seamClaim(seams)]),
    cycleClaim,
    ...under("isolate", isolationClaims(isolate)),
    ...under("members", apiSurfaces.length === 0 ? [] : [apiSurfaceClaim(apiSurfaces)]),
    ...under("members", grants.length === 0 ? [] : [grantClaim(grants)]),
    ...under("maxFilesPerDirectory", directoryClaims(maxFilesPerDirectory, directoryLimits)),
    ...under("duplication", duplicationClaims(duplication, boundaries)),
    ...under("reviewable", reviewable === undefined ? [] : [reviewClaim(reviewable, changes)]),
    ...under("colocation", colocation ? placementClaims(zones) : []),
    ...under("readerships", readerships ? [readershipClaim(roleZonesIn(zones))] : []),
    ...under("testInternals", testInternals ? [internalsFor(zones)] : []),
    ...under("rules", customClaims(rules)),
  ];
};

export async function check(options: CheckOptions): Promise<Report> {
  const { root, runners = [] } = options;
  const delegated = runDelegated(runners, root);
  const { graph, zones, lexicon, project } = analyseProject(options);
  const report = runClaims(claimsFor(options), { root, graph, zones, lexicon, project });

  return {
    claims: withoutDuplicates([...report.claims, ...under("runners", await delegated)]),
    coverage: report.coverage,
  };
}
