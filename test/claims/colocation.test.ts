import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { claimIn } from "../support/report.ts";
import { PROJECT_ZONES as ZONES } from "../support/zones.ts";
import { check } from "../../src/compose.ts";
import type { Report } from "../../src/report/model.ts";
import type { ZoneDefinition } from "../../src/zones/model.ts";

const ROOT = fixtureAt("project");
const CLAIM = "no-value-is-declared-away-from-its-only-consumer";

const runWith = (zones: readonly ZoneDefinition[] = ZONES, colocation = true): Report =>
  check({ root: ROOT, zones, colocation });

describe("keeping a value with its only consumer", () => {
  it("stays quiet until switched on", () => {
    expect(claimIn(check({ root: ROOT, zones: ZONES }), CLAIM)).toBeUndefined();
  });

  it("names the declaring file and the one file that uses it", () => {
    const findings = claimIn(runWith(), CLAIM)?.findings ?? [];

    expect(findings).toHaveLength(1);
    expect(findings[0]?.file).toBe(join(ROOT, "src/domain/thing.ts"));
    expect(findings[0]?.message).toContain("used only by src/engine/runner.ts");
  });

  it("says nothing when the consuming zone never owns what it uses", () => {
    const zones: readonly ZoneDefinition[] = [
      { name: "engine", patterns: ["src/engine/**"], role: "wiring" },
      { name: "domain", patterns: ["src/domain/**"] },
    ];

    expect(claimIn(runWith(zones), CLAIM)?.findings).toEqual([]);
  });

  it("tells the reader when giving a zone a role is honest", () => {
    expect(claimIn(runWith(), CLAIM)?.guidance).toContain("never owns what it uses");
  });
});

const SHARED = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "colocated");
const TEST_ONLY = "no-export-exists-only-for-a-test";

const sharedReport = check({
  root: SHARED,
  colocation: true,
  zones: [
    { name: "spec", patterns: ["src/spec/**"], role: "tests" },
    { name: "shared", patterns: ["src/shared/**"] },
    { name: "web", patterns: ["src/web/**"] },
    { name: "server", patterns: ["src/server/**"] },
  ],
});

const messagesFor = (claim: string): readonly string[] =>
  sharedReport.claims.find((entry) => entry.claim === claim)?.findings.map((finding) => finding.message) ??
  [];

describe("an export that exists only for its test", () => {
  it("reports a value nothing outside the tests uses", () => {
    expect(messagesFor(TEST_ONLY)).toEqual(["exports ONLY_A_TEST_READS_THIS, which only tests use"]);
  });

  it("says nothing about a value production also uses", () => {
    expect(messagesFor(TEST_ONLY).join()).not.toContain("usedInProduction");
  });

  it("counts a consumer in the declaring zone, which crosses no boundary to be seen", () => {
    expect(messagesFor(TEST_ONLY).join()).not.toContain("usedBySibling");
  });

  it("names the fix that would make the codebase worse", () => {
    const claim = sharedReport.claims.find((entry) => entry.claim === TEST_ONLY);
    expect(claim?.guidance).toContain("Adding a production caller to satisfy this check");
  });

  it("stays quiet when no zone is declared as tests", () => {
    const report = check({
      root: SHARED,
      colocation: true,
      zones: [{ name: "all", patterns: ["src/**"] }],
    });

    expect(report.claims.find((entry) => entry.claim === TEST_ONLY)).toBeUndefined();
  });
});

describe("a shared zone that is not actually shared", () => {
  const findings = sharedReport.claims.find((claim) => claim.claim === CLAIM)?.findings ?? [];

  it("reports a value several files in one zone use, which counting files would miss", () => {
    expect(findings.map((finding) => finding.message)).toContain(
      "declares forWebOnly, used only by web (2 files)",
    );
  });

  it("says nothing about a value two zones genuinely share", () => {
    expect(findings.map((finding) => finding.message).join()).not.toContain("forBoth");
  });
});
