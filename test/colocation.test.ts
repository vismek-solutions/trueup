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

  it("says nothing when the consumer's zone is declared as wiring", () => {
    const zones: readonly ZoneDefinition[] = [
      { name: "engine", patterns: ["src/engine/**"], wiring: true },
      { name: "domain", patterns: ["src/domain/**"] },
    ];

    expect(claimIn(runWith(zones))?.findings).toEqual([]);
  });

  it("tells the reader that declaring a zone as wiring must be honest", () => {
    expect(claimIn(runWith())?.guidance).toContain("composition root");
  });
});
