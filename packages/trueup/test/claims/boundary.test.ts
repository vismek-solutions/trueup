import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import type { BoundaryRule } from "../../src/claims/boundary.ts";
import { check } from "../../src/compose.ts";
import type { Finding } from "../../src/report/model.ts";

const ROOT = fixtureAt("boundary");

const ZONES = [
  { name: "warrants", patterns: ["shared/warrants.ts"] },
  { name: "shared", patterns: ["shared/**"] },
  { name: "components", patterns: ["components/**"] },
  { name: "reaching", patterns: ["reaching/**"] },
];

const boundaryFindings = (rule: BoundaryRule): readonly Finding[] => {
  const report = check({ root: ROOT, zones: ZONES, boundaries: [rule] });
  return (
    report.claims.find((claim) => claim.claim === "every-import-respects-its-zone-boundary")?.findings ?? []
  );
};

describe("a boundary crossed through a barrel", () => {
  it("is seen when the edge is anchored on the declaring file", () => {
    const findings = boundaryFindings({ from: "components", allow: ["shared"] });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("Warrant");
    expect(findings[0]?.message).toContain("shared/warrants.ts through shared/index.ts");
  });

  it("is invisible when the edge is anchored on the module the specifier named", () => {
    expect(boundaryFindings({ from: "components", allow: ["shared"], anchor: "imported-module" })).toEqual(
      [],
    );
  });

  it("does not flag a sibling symbol that the same barrel re-exports", () => {
    const findings = boundaryFindings({ from: "components", allow: ["shared"] });

    expect(findings.map((finding) => finding.message).join()).not.toContain("other");
  });

  it("can be told to ignore a type-only import", () => {
    expect(boundaryFindings({ from: "components", allow: ["shared"], ignoreTypeOnly: true })).toEqual([]);
  });

  it("says nothing when the origin zone has no rule", () => {
    expect(boundaryFindings({ from: "shared", allow: ["warrants"] })).toEqual([]);
  });
});

describe("a boundary crossed by something other than a plain named import", () => {
  const messages = (): readonly string[] =>
    boundaryFindings({ from: "reaching", allow: [] }).map((finding) => finding.message);

  it("is crossed by taking the whole module, which lands in the module's own zone", () => {
    expect(messages()).toContain("is reaching and may not reach warrants: * from shared/warrants.ts");
  });

  it("is crossed by asking for a name the module never exported", () => {
    expect(messages()).toContain("is reaching and may not reach warrants: absent from shared/warrants.ts");
  });
});

describe("two rules for one zone", () => {
  it("reports a breached edge once, not once per rule", () => {
    const report = check({
      root: ROOT,
      zones: ZONES,
      boundaries: [
        { from: "components", allow: ["shared"] },
        { from: "components", allow: [] },
      ],
    });

    const findings =
      report.claims.find((claim) => claim.claim === "every-import-respects-its-zone-boundary")?.findings ??
      [];
    const warrants = findings.filter((finding) => finding.message.includes("Warrant"));

    expect(warrants).toHaveLength(1);
  });
});

describe("rule validation", () => {
  it("rejects a rule naming a zone that was never declared", () => {
    const report = check({
      root: ROOT,
      zones: ZONES,
      boundaries: [{ from: "components", allow: ["typo"] }],
    });

    const findings = report.claims.find(
      (claim) => claim.claim === "every-rule-names-a-declared-zone",
    )?.findings;
    expect(findings).toHaveLength(1);
    expect(findings?.[0]?.message).toContain("typo");
  });
});
