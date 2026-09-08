import type { BoundaryRule } from "../claims/boundary.ts";
import type { Rule } from "../claims/custom.ts";
import type { IsolationRule } from "../claims/isolation.ts";
import type { SeamRule } from "../claims/seam.ts";
import type { Protection } from "../ports/protection.ts";
import type { Runner } from "../ports/runner.ts";
import type { ZoneDefinition } from "../zones/model.ts";

export interface MemberConfig {
  readonly zones: readonly ZoneDefinition[];
  readonly allow?: readonly string[] | undefined;
  readonly boundaries?: readonly BoundaryRule[] | undefined;
}

export interface ArchitectureConfig {
  readonly command?: string | undefined;
  readonly include?: readonly string[] | undefined;
  readonly members?: readonly string[] | undefined;
  readonly zones?: readonly ZoneDefinition[] | undefined;
  readonly boundaries?: readonly BoundaryRule[] | undefined;
  readonly seams?: readonly SeamRule[] | undefined;
  readonly isolate?: readonly IsolationRule[] | undefined;
  readonly protect?: Protection | undefined;
  readonly maxFilesPerDirectory?: number | undefined;
  readonly duplication?: number | undefined;
  readonly colocation?: boolean | undefined;
  readonly rules?: readonly Rule[] | undefined;
  readonly runners?: readonly Runner[] | undefined;
  readonly extensions?: readonly string[] | undefined;
  readonly externals?: readonly string[] | undefined;
  readonly ignoreDirectories?: readonly string[] | undefined;
}

export type ResolvedConfig = ArchitectureConfig & { readonly zones: readonly ZoneDefinition[] };

export const defineConfig = (config: ArchitectureConfig): ArchitectureConfig => config;

export const defineMember = (config: MemberConfig): MemberConfig => config;
