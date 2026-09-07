import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { BoundaryRule } from "../src/claims/boundary.js";
import { check } from "../src/compose.js";
import type { Finding } from "../src/report/model.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "boundary");

const ZONES = [
  { name: "warrants", patterns: ["shared/warrants.ts"] },
  { name: "shared", patterns: ["shared/**"] },
  { name: "components", patterns: ["components/**"] },
];

const boundaryFindings = (rule: BoundaryRule): readonly Finding[] => {
  const report = check({ root: ROOT, zones: ZONES, rules: [rule] });
  return report.claims.find((claim) => claim.claim === "every-import-respects-its-zone-boundary")?.findings ?? [];
};

describe("a boundary crossed through a barrel", () => {
  it("is seen when the edge is anchored on the declaring file", () => {
    const findings = boundaryFindings({ from: "components", mayNotReach: ["warrants"] });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("Warrant");
    expect(findings[0]?.message).toContain("shared/warrants.ts through shared/index.ts");
  });

  it("is invisible when the edge is anchored on the module the specifier named", () => {
    expect(boundaryFindings({ from: "components", mayNotReach: ["warrants"], anchor: "imported-module" })).toEqual([]);
  });

  it("does not flag a sibling symbol that the same barrel re-exports", () => {
    const findings = boundaryFindings({ from: "components", mayNotReach: ["warrants"] });

    expect(findings.map((finding) => finding.message).join()).not.toContain("other");
  });

  it("can be told to ignore a type-only import", () => {
    expect(
      boundaryFindings({ from: "components", mayNotReach: ["warrants"], ignoreTypeOnly: true }),
    ).toEqual([]);
  });

  it("says nothing when the origin zone has no rule", () => {
    expect(boundaryFindings({ from: "shared", mayNotReach: ["warrants"] })).toEqual([]);
  });
});

describe("rule validation", () => {
  it("rejects a rule naming a zone that was never declared", () => {
    const report = check({
      root: ROOT,
      zones: ZONES,
      rules: [{ from: "components", mayNotReach: ["typo"] }],
    });

    const findings = report.claims.find((claim) => claim.claim === "every-rule-names-a-declared-zone")?.findings;
    expect(findings).toHaveLength(1);
    expect(findings?.[0]?.message).toContain("typo");
  });
});
