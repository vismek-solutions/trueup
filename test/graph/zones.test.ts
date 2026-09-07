import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURES } from "../support/fixtures.ts";
import { check } from "../../src/compose.ts";
import { assignZones } from "../../src/zones/assign.ts";

const ROOT = "/project";
const at = (...parts: string[]): string => join(ROOT, ...parts);

describe("zone assignment", () => {
  it("assigns a file to the first zone whose pattern matches", () => {
    const zones = assignZones({
      root: ROOT,
      files: [at("src/engine/runner.ts")],
      zones: [
        { name: "engine", patterns: ["src/engine/**"] },
        { name: "everything", patterns: ["src/**"] },
      ],
    });

    expect(zones.zoneOf(at("src/engine/runner.ts"))).toBe("engine");
  });

  it("assigns to the later zone when the earlier one does not match", () => {
    const zones = assignZones({
      root: ROOT,
      files: [at("src/other/thing.ts")],
      zones: [
        { name: "engine", patterns: ["src/engine/**"] },
        { name: "everything", patterns: ["src/**"] },
      ],
    });

    expect(zones.zoneOf(at("src/other/thing.ts"))).toBe("everything");
  });

  it("collects a file that matches no zone rather than dropping it", () => {
    const zones = assignZones({
      root: ROOT,
      files: [at("stray.ts")],
      zones: [{ name: "engine", patterns: ["src/engine/**"] }],
    });

    expect(zones.zoneOf(at("stray.ts"))).toBeNull();
    expect(zones.unclassified).toEqual([at("stray.ts")]);
  });

  it("names a zone that matched nothing", () => {
    const zones = assignZones({
      root: ROOT,
      files: [at("src/engine/runner.ts")],
      zones: [
        { name: "engine", patterns: ["src/engine/**"] },
        { name: "ghost", patterns: ["src/ghost/**"] },
      ],
    });

    expect(zones.emptyZones).toEqual(["ghost"]);
  });

  it("names a pattern that matched nothing even when its zone is populated", () => {
    const zones = assignZones({
      root: ROOT,
      files: [at("src/engine/runner.ts")],
      zones: [{ name: "engine", patterns: ["src/engine/**", "src/kernel/**"] }],
    });

    expect(zones.emptyZones).toEqual([]);
    expect(zones.deadPatterns).toEqual([{ zone: "engine", pattern: "src/kernel/**" }]);
  });

  it("reports the files it placed in a zone", () => {
    const zones = assignZones({
      root: ROOT,
      files: [at("src/engine/a.ts"), at("src/engine/b.ts"), at("src/domain/c.ts")],
      zones: [
        { name: "engine", patterns: ["src/engine/**"] },
        { name: "domain", patterns: ["src/domain/**"] },
      ],
    });

    expect(zones.filesIn("engine")).toEqual([at("src/engine/a.ts"), at("src/engine/b.ts")]);
    expect(zones.filesIn("domain")).toEqual([at("src/domain/c.ts")]);
  });
});

describe("a check run", () => {
  it("runs every claim in one pass rather than stopping at the first failure", () => {
    const report = check({
      root: join(FIXTURES, "zoned"),
      zones: [
        { name: "engine", patterns: ["engine/**"] },
        { name: "domain", patterns: ["domain/**"] },
        { name: "ghost", patterns: ["ghost/**"] },
      ],
    });

    const firing = report.claims.filter((claim) => claim.findings.length > 0).map((claim) => claim.claim);

    expect(firing.sort()).toEqual([
      "every-file-belongs-to-a-zone",
      "every-import-resolves",
      "every-zone-has-a-file",
      "every-zone-pattern-matches-a-file",
    ]);
  });

  it("reports a result for every claim, including those that found nothing", () => {
    const report = check({
      root: join(FIXTURES, "zoned"),
      zones: [{ name: "everything", patterns: ["**"] }],
    });

    expect(report.claims.map((claim) => claim.claim)).toEqual([
      "the-analysis-reached-files",
      "every-import-resolves",
      "every-imported-name-is-exported",
      "every-imported-name-is-unambiguous",
      "every-file-belongs-to-a-zone",
      "every-zone-has-a-file",
      "every-zone-pattern-matches-a-file",
      "every-rule-names-a-declared-zone",
      "every-import-respects-its-zone-boundary",
      "generic-code-names-no-domain-concept",
    ]);
  });

  it("reports coverage alongside findings so a clean run can be told from an empty one", () => {
    const report = check({
      root: join(FIXTURES, "zoned"),
      zones: [
        { name: "engine", patterns: ["engine/**"] },
        { name: "domain", patterns: ["domain/**"] },
        { name: "loose", patterns: ["*.ts"] },
      ],
    });

    expect(report.coverage.files).toBe(3);
    expect(report.coverage.filesByZone).toEqual({ engine: 1, domain: 1, loose: 1 });
    expect(report.coverage.unclassifiedFiles).toBe(0);
    expect(report.coverage.symbolEdges).toBe(1);
    expect(report.coverage.unresolvedImports).toBe(1);
  });

  it("fails when no file was analysed instead of passing vacuously", () => {
    const report = check({
      root: join(FIXTURES, "zoned"),
      zones: [{ name: "everything", patterns: ["**"] }],
      extensions: [".nothing"],
    });

    const reached = report.claims.find((claim) => claim.claim === "the-analysis-reached-files");
    expect(reached?.findings).toHaveLength(1);
  });
});
