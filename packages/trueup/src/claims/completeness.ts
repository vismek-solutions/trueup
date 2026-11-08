import type { Claim } from "./model.ts";

const everyFileBelongsToAZone: Claim = {
  name: "every-file-belongs-to-a-zone",
  check: ({ zones }) => ({
    findings: zones.unclassified.map((file) => ({
      severity: "error",
      message: "matches no zone",
      file,
      start: null,
    })),
    guidance: `A file matches no zone, so no boundary or seam rule applies to it.

Do this:
- Move it under an existing zone.
- Or declare a zone that covers it.
- Run \`{trueup} explain <file>\` to see what a location would allow.`,
  }),
};

const everyZoneHasAFile: Claim = {
  name: "every-zone-has-a-file",
  check: ({ zones }) => ({
    findings: zones.emptyZones.map((zone) => ({
      severity: "error",
      message: `zone ${zone} matches no file`,
      file: null,
      start: null,
    })),
    guidance: `A declared zone matches nothing, which silently disables every rule naming it.

Do this:
- Fix its patterns.
- Or remove the zone.`,
  }),
};

const everyZonePatternMatchesAFile: Claim = {
  name: "every-zone-pattern-matches-a-file",
  check: ({ zones }) => ({
    findings: zones.deadPatterns.map(({ zone, pattern }) => ({
      severity: "error",
      message: `zone ${zone} pattern ${pattern} matches no file`,
      file: null,
      start: null,
    })),
    guidance: `A zone pattern matches nothing.

Do this:
- Check the zones above it first: a file belongs to the first zone that matches it.
- Fix the pattern, or delete it.`,
  }),
};

export const completenessClaims: readonly Claim[] = [
  everyFileBelongsToAZone,
  everyZoneHasAFile,
  everyZonePatternMatchesAFile,
];
