import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { PROJECT_ZONES as ZONES } from "../support/zones.ts";
import { RUNNERS_RAN_CLAIM } from "../../src/claims/delegated.ts";
import { check } from "../../src/main.ts";
import type { Runner, RunnerFinding } from "../../src/ports/runner.ts";
import { countOf, type Report } from "../../src/report/model.ts";
import { applyBaseline, baselineOf } from "../../src/ratchet/apply.ts";

const ROOT = fixtureAt("project");

const finding = (category: string, message: string): RunnerFinding => ({
  category,
  message,
  file: join(ROOT, "src/engine/runner.ts"),
  start: 0,
  severity: "error",
});

const reporting = (findings: readonly RunnerFinding[]): Runner => ({
  name: "stub",
  run: async () => ({ kind: "findings", findings }),
});

const failing = (reason: string): Runner => ({
  name: "stub",
  run: async () => ({ kind: "failed", reason }),
});

const reportWith = (runners: readonly Runner[]): Promise<Report> =>
  check({ root: ROOT, zones: ZONES, runners });

const claimNames = (report: Report): string[] => report.claims.map((claim) => claim.claim);

describe("a delegated tool", () => {
  it("contributes one claim per category it reports", async () => {
    const report = await reportWith([
      reporting([
        finding("unused_exports", "unused exports: helper"),
        finding("circular_dependencies", "a -> b"),
      ]),
    ]);

    expect(claimNames(report)).toContain("stub/unused_exports");
    expect(claimNames(report)).toContain("stub/circular_dependencies");
  });

  it("adds nothing at all when none is configured", async () => {
    expect(claimNames(await reportWith([]))).not.toContain(RUNNERS_RAN_CLAIM);
  });

  it("fails the run when it cannot execute, rather than being quietly skipped", async () => {
    const report = await reportWith([failing("command not found")]);
    const ran = report.claims.find((claim) => claim.claim === RUNNERS_RAN_CLAIM);

    expect(ran?.findings).toHaveLength(1);
    expect(ran?.findings[0]?.severity).toBe("error");
    expect(ran?.findings[0]?.message).toContain("command not found");
  });

  it("reports no failure when it ran and found nothing", async () => {
    const report = await reportWith([reporting([])]);
    expect(report.claims.find((claim) => claim.claim === RUNNERS_RAN_CLAIM)?.findings).toEqual([]);
  });

  it("orders its claims by name, whatever order the tool reported them in", async () => {
    const report = await reportWith([reporting([finding("z_last", "z"), finding("a_first", "a")])]);
    const delegated = claimNames(report).filter((name) => name.startsWith("stub/"));

    expect(delegated).toEqual(["stub/a_first", "stub/z_last"]);
  });

  it("gathers a category reported more than once into one claim", async () => {
    const report = await reportWith([
      reporting([finding("unused_exports", "one"), finding("unused_exports", "two")]),
    ]);
    const claim = report.claims.find((entry) => entry.claim === "stub/unused_exports");

    expect(claim?.findings.map((found) => found.message)).toEqual(["one", "two"]);
  });

  it("carries a finding's group through, so a tool can say two of them are one problem", async () => {
    const grouped: RunnerFinding = { ...finding("code_duplication", "copied"), group: "body-one" };
    const report = await reportWith([reporting([grouped])]);

    expect(report.claims.find((entry) => entry.claim === "stub/code_duplication")?.findings[0]).toMatchObject(
      { group: "body-one" },
    );
  });

  it("leaves the group off a finding that has none, rather than inventing an empty one", async () => {
    const report = await reportWith([reporting([finding("unused_exports", "one")])]);
    const [found] = report.claims.find((entry) => entry.claim === "stub/unused_exports")?.findings ?? [];

    expect(found === undefined ? true : "group" in found).toBe(false);
  });

  it("says which tool a finding came from, since the rules here did not produce it", async () => {
    const report = await reportWith([reporting([finding("unused_exports", "one")])]);

    expect(report.claims.find((entry) => entry.claim === "stub/unused_exports")?.guidance).toContain(
      "Reported by stub",
    );
  });
});

describe("more than one delegated tool", () => {
  const named = (name: string, findings: readonly RunnerFinding[]): Runner => ({
    name,
    run: async () => ({ kind: "findings", findings }),
  });

  it("keeps one that failed from hiding what another found", async () => {
    const report = await reportWith([
      failing("command not found"),
      named("other", [finding("dupes", "copied")]),
    ]);

    expect(claimNames(report)).toContain("other/dupes");
    expect(report.claims.find((claim) => claim.claim === RUNNERS_RAN_CLAIM)?.findings).toHaveLength(1);
  });

  it("reports every failure, not only the first tool that could not run", async () => {
    const report = await reportWith([
      failing("command not found"),
      { ...failing("exited 2"), name: "other" },
    ]);
    const ran = report.claims.find((claim) => claim.claim === RUNNERS_RAN_CLAIM);

    expect(ran?.findings.map((found) => found.message)).toEqual([
      "stub did not run: command not found",
      "other did not run: exited 2",
    ]);
  });

  it("keeps two tools' categories apart even when they share a name", async () => {
    const report = await reportWith([
      named("one", [finding("dupes", "from one")]),
      named("two", [finding("dupes", "from two")]),
    ]);

    expect(claimNames(report)).toContain("one/dupes");
    expect(claimNames(report)).toContain("two/dupes");
  });
});

describe("a baseline over both our claims and a delegated tool", () => {
  it("covers the delegated findings too", async () => {
    const report = await reportWith([reporting([finding("unused_exports", "unused exports: helper")])]);
    const baseline = baselineOf(report, ROOT);

    expect(baseline.entries.map((entry) => entry.claim)).toContain("stub/unused_exports");

    const ratcheted = applyBaseline({ report, baseline, root: ROOT });
    expect(countOf(ratcheted.report, "error")).toBe(0);
  });

  it("never records a tool that failed to run", async () => {
    const report = await reportWith([failing("command not found")]);
    const baseline = baselineOf(report, ROOT);

    expect(baseline.entries.map((entry) => entry.claim)).not.toContain(RUNNERS_RAN_CLAIM);
    expect(countOf(applyBaseline({ report, baseline, root: ROOT }).report, "error")).toBeGreaterThan(0);
  });
});
