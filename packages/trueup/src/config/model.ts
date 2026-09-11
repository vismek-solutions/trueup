import type { BoundaryRule } from "../claims/boundary.ts";
import type { Rule } from "../claims/custom.ts";
import type { IsolationRule } from "../claims/isolation/siblings.ts";
import type { ApiSurface } from "../claims/members/api-surface.ts";
import type { MemberGrants } from "../claims/members/grants.ts";
import type { DirectoryLimit } from "../claims/placement/directories.ts";
import type { ReviewBudget } from "../claims/review/budget.ts";
import type { SeamRule } from "../claims/seam.ts";
import type { Changes } from "../ports/changes.ts";
import type { Protection } from "../ports/protection.ts";
import type { Runner } from "../ports/runner.ts";
import type { ZoneDefinition } from "../zones/model.ts";

export interface MemberConfig {
  readonly zones: readonly ZoneDefinition[];
  readonly allow?: readonly string[] | undefined;
  readonly boundaries?: readonly BoundaryRule[] | undefined;
  readonly seams?: readonly SeamRule[] | undefined;
  readonly isolate?: readonly IsolationRule[] | undefined;
  readonly rules?: readonly Rule[] | undefined;
  readonly maxFilesPerDirectory?: number | undefined;
  readonly doorsFromExports?: boolean | undefined;
}

export interface Settings {
  readonly zones?: readonly ZoneDefinition[] | undefined;
  readonly boundaries?: readonly BoundaryRule[] | undefined;
  readonly seams?: readonly SeamRule[] | undefined;
  readonly isolate?: readonly IsolationRule[] | undefined;
  readonly maxFilesPerDirectory?: number | undefined;
  readonly duplication?: number | undefined;
  readonly reviewable?: ReviewBudget | undefined;
  readonly colocation?: boolean | undefined;
  readonly readerships?: boolean | undefined;
  readonly testInternals?: boolean | undefined;
  readonly rules?: readonly Rule[] | undefined;
  readonly runners?: readonly Runner[] | undefined;
  readonly changes?: Changes | undefined;
  readonly extensions?: readonly string[] | undefined;
  readonly externals?: readonly string[] | undefined;
  readonly ignoreDirectories?: readonly string[] | undefined;
}

export interface ArchitectureConfig extends Settings {
  readonly command?: string | undefined;
  readonly include?: readonly string[] | undefined;
  readonly members?: readonly string[] | undefined;
  readonly protect?: Protection | undefined;
}

export type ResolvedConfig = ArchitectureConfig & {
  readonly zones: readonly ZoneDefinition[];
  readonly boundaries: readonly BoundaryRule[];
  readonly seams: readonly SeamRule[];
  readonly isolate: readonly IsolationRule[];
  readonly rules: readonly Rule[];
  readonly directoryLimits: readonly DirectoryLimit[];
  readonly apiSurfaces: readonly ApiSurface[];
  readonly grants: readonly MemberGrants[];
};

export const defineConfig = (config: ArchitectureConfig): ArchitectureConfig => config;

export const defineMember = (config: MemberConfig): MemberConfig => config;
