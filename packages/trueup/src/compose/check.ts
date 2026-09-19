import { gitChanges } from "../adapters/git/changes.ts";
import {
  boundaryClaim,
  boundaryZoneReferences,
  type BoundaryRule,
  type RefusalNotes,
} from "../claims/boundary.ts";
import { completenessClaims } from "../claims/completeness.ts";
import { customClaims } from "../claims/custom.ts";
import { cycleClaim } from "../claims/cycles.ts";
import { runDelegated } from "../claims/delegated.ts";
import {
  isolationClaim,
  loosePlacementClaim,
  type IsolationRule,
} from "../claims/isolation/siblings.ts";
import { apiSurfaceClaim, type ApiSurface } from "../claims/members/api-surface.ts";
import { grantClaim, type MemberGrants } from "../claims/members/grants.ts";
import type { Claim } from "../claims/model.ts";
import { colocationClaim } from "../claims/placement/colocation.ts";
import { directoryClaim, type DirectoryLimit } from "../claims/placement/directories.ts";
import { duplicationClaim } from "../claims/placement/duplication.ts";
import { readershipClaim } from "../claims/placement/readership.ts";
import { testInternalsClaim, testOnlyExportClaim } from "../claims/placement/test-surface.ts";
import { resolutionClaims } from "../claims/resolution.ts";
import { reviewClaim } from "../claims/review/budget.ts";
import { runClaims } from "../claims/run.ts";
import { seamClaim, seamZoneReferences } from "../claims/seam.ts";
import { zoneReferencesExistClaim } from "../claims/zone-references.ts";
import type { Settings } from "../config/model.ts";
import { withoutDuplicates, type Report } from "../report/model.ts";
import { textClaims } from "../text/claims.ts";
import type { ZoneDefinition, ZoneRole } from "../zones/model.ts";
import { analyseProject, type Overlay } from "./analysis.ts";

export interface CheckOptions extends Settings {
  readonly root: string;
  readonly roots?: readonly string[] | undefined;
  readonly zones: readonly ZoneDefinition[];
  readonly directoryLimits?: readonly DirectoryLimit[] | undefined;
  readonly apiSurfaces?: readonly ApiSurface[] | undefined;
  readonly grants?: readonly MemberGrants[] | undefined;
  readonly doorNotes?: RefusalNotes | undefined;
  readonly overlay?: Overlay | undefined;
  readonly ignoreFiles?: readonly string[] | undefined;
}

const namesOf = (zones: readonly ZoneDefinition[], role: ZoneRole): string[] =>
  zones.filter((zone) => zone.role === role).map((zone) => zone.name);

const roleZonesIn = (zones: readonly ZoneDefinition[]): string[] => [
  ...namesOf(zones, "wiring"),
  ...namesOf(zones, "tests"),
  ...namesOf(zones, "api"),
];

const placementClaims = ({ zones, isolate = [], root }: CheckOptions): Claim[] => {
  const testZones = namesOf(zones, "tests");
  const apiZones = namesOf(zones, "api");

  return [
    colocationClaim(roleZonesIn(zones), { zones, groups: isolate.map((rule) => rule.siblings), root }),
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
  const { maxFilesPerDirectory, directoryLimits = [], apiSurfaces = [], grants = [], doorNotes } = options;
  const { duplication, reviewable, colocation, readerships, testInternals, text } = options;
  const { changes = gitChanges() } = options;

  return [
    ...resolutionClaims,
    ...completenessClaims,
    zoneReferencesExistClaim([...boundaryZoneReferences(boundaries), ...seamZoneReferences(seams)]),
    ...under("boundaries", boundaries.length === 0 ? [] : [boundaryClaim(boundaries, doorNotes)]),
    ...under("seams", seams.length === 0 ? [] : [seamClaim(seams)]),
    cycleClaim,
    ...under("isolate", isolationClaims(isolate)),
    ...under("members", apiSurfaces.length === 0 ? [] : [apiSurfaceClaim(apiSurfaces)]),
    ...under("members", grants.length === 0 ? [] : [grantClaim(grants)]),
    ...under("maxFilesPerDirectory", directoryClaims(maxFilesPerDirectory, directoryLimits)),
    ...under("duplication", duplicationClaims(duplication, boundaries)),
    ...under("reviewable", reviewable === undefined ? [] : [reviewClaim(reviewable, changes)]),
    ...under("colocation", colocation ? placementClaims(options) : []),
    ...under("readerships", readerships ? [readershipClaim(roleZonesIn(zones))] : []),
    ...under("testInternals", testInternals ? [internalsFor(zones)] : []),
    ...under("text", text === undefined ? [] : textClaims(text)),
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
