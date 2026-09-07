import { discoverFiles, readSource, type DiscoverFilesOptions } from "./adapters/node-files.js";
import { parseModule } from "./adapters/oxc-parse.js";
import { createResolver } from "./adapters/oxc-resolve.js";
import { boundaryClaim, ruleZonesExistClaim, type BoundaryRule } from "./claims/boundary.js";
import { completenessClaims } from "./claims/completeness.js";
import type { Claim } from "./claims/model.js";
import { resolutionClaims } from "./claims/resolution.js";
import { buildSymbolGraph } from "./graph/build.js";
import type { SymbolGraph } from "./graph/model.js";
import type { Report } from "./report/model.js";
import { runClaims } from "./report/run.js";
import { assignZones } from "./zones/assign.js";
import type { ZoneDefinition } from "./zones/model.js";

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
