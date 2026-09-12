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
    guidance: [
      "A file matches no zone, so no boundary or seam rule applies to it.",
      "",
      "Do this:",
      "- Move it under an existing zone.",
      "- Or declare a zone that covers it.",
      "- Run `{trueup} explain <file>` to see what a location would allow.",
    ].join("\n"),
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
    guidance: [
      "A declared zone matches nothing, which silently disables every rule naming it.",
      "",
      "Do this:",
      "- Fix its patterns.",
      "- Or remove the zone.",
    ].join("\n"),
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
    guidance: [
      "A pattern matches nothing, so it is a rule you believe you have and do not.",
      "",
      "Do this:",
      "- Fix the pattern, or delete it.",
      "- Check the zones above it first. Zones match first-match-wins, so an earlier zone may already have taken these files.",
    ].join("\n"),
  }),
};

export const completenessClaims: readonly Claim[] = [
  everyFileBelongsToAZone,
  everyZoneHasAFile,
  everyZonePatternMatchesAFile,
];
