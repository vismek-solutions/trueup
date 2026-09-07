import type { BoundaryRule } from "../claims/boundary.ts";
import type { ZoneDefinition } from "../zones/model.ts";

export interface ArchitectureConfig {
  readonly include?: readonly string[] | undefined;
  readonly zones: readonly ZoneDefinition[];
  readonly rules?: readonly BoundaryRule[] | undefined;
  readonly extensions?: readonly string[] | undefined;
  readonly ignoreDirectories?: readonly string[] | undefined;
}

export const defineConfig = (config: ArchitectureConfig): ArchitectureConfig => config;
