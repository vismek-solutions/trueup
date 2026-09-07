import type { Claim } from "./model.ts";

export interface ZoneReference {
  readonly rule: string;
  readonly zone: string;
}

export function zoneReferencesExistClaim(references: readonly ZoneReference[]): Claim {
  return {
    name: "every-rule-names-a-declared-zone",
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
