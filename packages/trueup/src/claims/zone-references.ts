import type { Claim } from "./model.ts";

export interface ZoneReference {
  readonly rule: string;
  readonly zone: string;
}

export function zoneReferencesExistClaim(references: readonly ZoneReference[]): Claim {
  return {
    name: "every-rule-names-a-declared-zone",
    guidance: [
      "A rule names a zone that is not declared, so the rule never fires and the boundary it describes is not enforced.",
      "",
      "Do this:",
      "- Correct the name in the rule.",
      "- Or declare the zone it names.",
    ].join("\n"),
    check: ({ zones }) => {
      const declared = new Set(zones.declaredNames);
      return references
        .filter((reference) => !declared.has(reference.zone))
        .map((reference) => ({
          severity: "error" as const,
          message: `${reference.rule} names zone ${reference.zone}, which is not declared`,
          file: null,
          start: null,
        }));
    },
  };
}
