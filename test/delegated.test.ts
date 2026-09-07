import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RUNNERS_RAN_CLAIM } from "../src/claims/delegated.ts";
import { check } from "../src/compose.ts";
import type { Runner, RunnerFinding } from "../src/ports/runner.ts";
import { countOf, type Report } from "../src/report/model.ts";
import { applyBaseline, baselineOf } from "../src/ratchet/apply.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "project");

const ZONES = [
  { name: "engine", patterns: ["src/engine/**"] },
  { name: "domain", patterns: ["src/domain/**"] },
];

const finding = (category: string, message: string): RunnerFinding => ({
  category,
  message,
  file: join(ROOT, "src/engine/runner.ts"),
  start: 0,
  severity: "error",
});

const reporting = (findings: readonly RunnerFinding[]): Runner => ({
  name: "stub",
  run: () => ({ kind: "findings", findings }),
});

const failing = (reason: string): Runner => ({
  name: "stub",
  run: () => ({ kind: "failed", reason }),
});

const reportWith = (runners: readonly Runner[]): Report => check({ root: ROOT, zones: ZONES, runners });

const claimNames = (report: Report): string[] => report.claims.map((claim) => claim.claim);

describe("a delegated tool", () => {
  it("contributes one claim per category it reports", () => {
    const report = reportWith([
      reporting([finding("unused_exports", "unused exports: helper"), finding("circular_dependencies", "a -> b")]),
    ]);

    expect(claimNames(report)).toContain("stub/unused_exports");
    expect(claimNames(report)).toContain("stub/circular_dependencies");
  });

  it("adds nothing at all when none is configured", () => {
    expect(claimNames(reportWith([]))).not.toContain(RUNNERS_RAN_CLAIM);
  });

  it("fails the run when it cannot execute, rather than being quietly skipped", () => {
    const report = reportWith([failing("command not found")]);
    const ran = report.claims.find((claim) => claim.claim === RUNNERS_RAN_CLAIM);

    expect(ran?.findings).toHaveLength(1);
    expect(ran?.findings[0]?.severity).toBe("error");
    expect(ran?.findings[0]?.message).toContain("command not found");
  });

  it("reports no failure when it ran and found nothing", () => {
    const report = reportWith([reporting([])]);
    expect(report.claims.find((claim) => claim.claim === RUNNERS_RAN_CLAIM)?.findings).toEqual([]);
  });

  it("keeps its findings in a stable order across runs", () => {
    const runners = [reporting([finding("z_last", "z"), finding("a_first", "a")])];
    expect(claimNames(reportWith(runners))).toEqual(claimNames(reportWith(runners)));
  });
});

describe("a baseline over both our claims and a delegated tool", () => {
  it("covers the delegated findings too", () => {
    const report = reportWith([reporting([finding("unused_exports", "unused exports: helper")])]);
    const baseline = baselineOf(report, ROOT);

    expect(baseline.entries.map((entry) => entry.claim)).toContain("stub/unused_exports");

    const ratcheted = applyBaseline({ report, baseline, root: ROOT });
    expect(countOf(ratcheted.report, "error")).toBe(0);
  });

  it("never records a tool that failed to run", () => {
    const report = reportWith([failing("command not found")]);
    const baseline = baselineOf(report, ROOT);

    expect(baseline.entries.map((entry) => entry.claim)).not.toContain(RUNNERS_RAN_CLAIM);
    expect(countOf(applyBaseline({ report, baseline, root: ROOT }).report, "error")).toBeGreaterThan(0);
  });
});
