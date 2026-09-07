import type { ZoneDefinition } from "../../src/zones/model.ts";

export const PROJECT_ZONES: readonly ZoneDefinition[] = [
  { name: "engine", patterns: ["src/engine/**"] },
  { name: "domain", patterns: ["src/domain/**"] },
];

export const SEAM_ZONES: readonly ZoneDefinition[] = [
  { name: "domain", patterns: ["domain/**"] },
  { name: "engine", patterns: ["engine/**"] },
];
