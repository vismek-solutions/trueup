import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { check } from "../src/compose.ts";
import type { Report } from "../src/report/model.ts";
import type { ZoneDefinition } from "../src/zones/model.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "project");
const CLAIM = "no-value-is-declared-away-from-its-only-consumer";

const ZONES: readonly ZoneDefinition[] = [
  { name: "engine", patterns: ["src/engine/**"] },
  { name: "domain", patterns: ["src/domain/**"] },
];

const runWith = (zones: readonly ZoneDefinition[] = ZONES, colocation = true): Report =>
  check({ root: ROOT, zones, colocation });

const claimIn = (report: Report) => report.claims.find((claim) => claim.claim === CLAIM);

describe("keeping a value with its only consumer", () => {
  it("stays quiet until switched on", () => {
    expect(claimIn(check({ root: ROOT, zones: ZONES }))).toBeUndefined();
  });

  it("names the declaring file and the one file that uses it", () => {
    const findings = claimIn(runWith())?.findings ?? [];

    expect(findings).toHaveLength(1);
    expect(findings[0]?.file).toBe(join(ROOT, "src/domain/thing.ts"));
    expect(findings[0]?.message).toContain("used only by src/engine/runner.ts");
  });

  it("says nothing when the consuming zone never owns what it uses", () => {
    const zones: readonly ZoneDefinition[] = [
      { name: "engine", patterns: ["src/engine/**"], consumesOnly: true },
      { name: "domain", patterns: ["src/domain/**"] },
    ];

    expect(claimIn(runWith(zones))?.findings).toEqual([]);
  });

  it("tells the reader when declaring a zone consumesOnly is honest", () => {
    expect(claimIn(runWith())?.guidance).toContain("composition root or a test suite");
  });
});

describe("a shared zone that is not actually shared", () => {
  const SHARED = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "colocated");

  const report = check({
    root: SHARED,
    colocation: true,
    zones: [
      { name: "shared", patterns: ["src/shared/**"] },
      { name: "web", patterns: ["src/web/**"] },
      { name: "server", patterns: ["src/server/**"] },
    ],
  });

  const findings = report.claims.find((claim) => claim.claim === CLAIM)?.findings ?? [];

  it("reports a value several files in one zone use, which counting files would miss", () => {
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toBe("declares forWebOnly, used only by web (2 files)");
  });

  it("says nothing about a value two zones genuinely share", () => {
    expect(findings.map((finding) => finding.message).join()).not.toContain("forBoth");
  });
});
