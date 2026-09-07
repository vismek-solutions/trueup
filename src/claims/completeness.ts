import { relative } from "node:path";
import type { Claim } from "./model.ts";

export const everyFileBelongsToAZone: Claim = {
  name: "every-file-belongs-to-a-zone",
  check: ({ root, zones }) =>
    zones.unclassified.map((file) => ({
      severity: "error",
      message: `${relative(root, file)} matches no zone`,
      file,
      start: null,
    })),
};

export const everyZoneHasAFile: Claim = {
  name: "every-zone-has-a-file",
  check: ({ zones }) =>
    zones.emptyZones.map((zone) => ({
      severity: "error",
      message: `zone ${zone} matches no file`,
      file: null,
      start: null,
    })),
};

export const everyZonePatternMatchesAFile: Claim = {
  name: "every-zone-pattern-matches-a-file",
  check: ({ zones }) =>
    zones.deadPatterns.map(({ zone, pattern }) => ({
      severity: "error",
      message: `zone ${zone} pattern ${pattern} matches no file`,
      file: null,
      start: null,
    })),
};

export const completenessClaims: readonly Claim[] = [
  everyFileBelongsToAZone,
  everyZoneHasAFile,
  everyZonePatternMatchesAFile,
];
