import type { BoundaryRule } from "../claims/boundary.ts";
import type { Rule } from "../claims/custom.ts";
import type { SeamRule } from "../claims/seam.ts";
import type { ZoneDefinition } from "../zones/model.ts";

export interface ArchitectureConfig {
  readonly include?: readonly string[] | undefined;
  readonly zones: readonly ZoneDefinition[];
  readonly boundaries?: readonly BoundaryRule[] | undefined;
  readonly seams?: readonly SeamRule[] | undefined;
  readonly rules?: readonly Rule[] | undefined;
  readonly extensions?: readonly string[] | undefined;
  readonly ignoreDirectories?: readonly string[] | undefined;
}

export const defineConfig = (config: ArchitectureConfig): ArchitectureConfig => config;
