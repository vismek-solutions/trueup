import { discoverFiles, readSource, type DiscoverFilesOptions } from "./adapters/node-files.ts";
import { parseModule } from "./adapters/oxc-parse.ts";
import { createResolver } from "./adapters/oxc-resolve.ts";
import { boundaryClaim, boundaryZoneReferences, type BoundaryRule } from "./claims/boundary.ts";
import { completenessClaims } from "./claims/completeness.ts";
import type { Claim } from "./claims/model.ts";
import { resolutionClaims } from "./claims/resolution.ts";
import { runClaims } from "./claims/run.ts";
import { seamClaim, seamZoneReferences, type SeamRule } from "./claims/seam.ts";
import { zoneReferencesExistClaim } from "./claims/zone-references.ts";
import { buildSymbolGraph } from "./graph/build.ts";
import type { SymbolGraph } from "./graph/model.ts";
import { buildLexicon } from "./lexicon/build.ts";
import type { ModuleRecord } from "./ports/module-record.ts";
import type { Report } from "./report/model.ts";
import { assignZones } from "./zones/assign.ts";
import type { ZoneDefinition } from "./zones/model.ts";

const readModules = (options: DiscoverFilesOptions): ModuleRecord[] =>
  discoverFiles(options).map((path) => parseModule(path, readSource(path)));

export function analyze(options: DiscoverFilesOptions): SymbolGraph {
  return buildSymbolGraph({ modules: readModules(options), resolve: createResolver() });
}

export interface CheckOptions {
  readonly root: string;
  readonly roots?: readonly string[] | undefined;
  readonly zones: readonly ZoneDefinition[];
  readonly rules?: readonly BoundaryRule[] | undefined;
  readonly seams?: readonly SeamRule[] | undefined;
  readonly extensions?: readonly string[] | undefined;
  readonly ignoreDirectories?: readonly string[] | undefined;
  readonly extraClaims?: readonly Claim[] | undefined;
}

export const standardClaims: readonly Claim[] = [...resolutionClaims, ...completenessClaims];

export function check({
  root,
  roots,
  zones,
  rules = [],
  seams = [],
  extensions,
  ignoreDirectories,
  extraClaims = [],
}: CheckOptions): Report {
  const modules = readModules({ roots: roots ?? [root], extensions, ignoreDirectories });
  const graph = buildSymbolGraph({ modules, resolve: createResolver() });
  const assignment = assignZones({ root, files: [...graph.files], zones });

  const claims = [
    ...standardClaims,
    zoneReferencesExistClaim([...boundaryZoneReferences(rules), ...seamZoneReferences(seams)]),
    boundaryClaim(rules),
    seamClaim(seams),
    ...extraClaims,
  ];

  return runClaims(claims, { root, graph, zones: assignment, lexicon: buildLexicon(modules) });
}
