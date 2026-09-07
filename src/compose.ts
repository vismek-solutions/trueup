import { discoverFiles, readSource, type DiscoverFilesOptions } from "./adapters/node-files.ts";
import { parseModule } from "./adapters/oxc-parse.ts";
import { createResolver } from "./adapters/oxc-resolve.ts";
import { boundaryClaim, ruleZonesExistClaim, type BoundaryRule } from "./claims/boundary.ts";
import { completenessClaims } from "./claims/completeness.ts";
import type { Claim } from "./claims/model.ts";
import { resolutionClaims } from "./claims/resolution.ts";
import { runClaims } from "./claims/run.ts";
import { buildSymbolGraph } from "./graph/build.ts";
import type { SymbolGraph } from "./graph/model.ts";
import type { Report } from "./report/model.ts";
import { assignZones } from "./zones/assign.ts";
import type { ZoneDefinition } from "./zones/model.ts";

export function analyze(options: DiscoverFilesOptions): SymbolGraph {
  const files = discoverFiles(options);
  const modules = files.map((path) => parseModule(path, readSource(path)));
  return buildSymbolGraph({ modules, resolve: createResolver() });
}

export interface CheckOptions {
  readonly root: string;
  readonly roots?: readonly string[] | undefined;
  readonly zones: readonly ZoneDefinition[];
  readonly rules?: readonly BoundaryRule[] | undefined;
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
  extensions,
  ignoreDirectories,
  extraClaims = [],
}: CheckOptions): Report {
  const graph = analyze({ roots: roots ?? [root], extensions, ignoreDirectories });
  const assignment = assignZones({ root, files: [...graph.files], zones });
  const claims = [...standardClaims, ruleZonesExistClaim(rules), boundaryClaim(rules), ...extraClaims];
  return runClaims(claims, { root, graph, zones: assignment });
}
