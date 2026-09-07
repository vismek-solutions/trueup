import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { baselinePathIn, readBaseline, writeBaseline } from "../src/adapters/baseline-file.ts";
import { EXIT_CLEAN, EXIT_ERRORS, EXIT_STALE_BASELINE, runCli } from "../src/cli/main.ts";
import type { Baseline } from "../src/ports/baseline.ts";
import { applyBaseline, baselineOf, STALE_CLAIM } from "../src/ratchet/apply.ts";
import type { Report } from "../src/report/model.ts";

const ROOT = "/project";

const reportOf = (claims: Report["claims"]): Report => ({
  claims,
  coverage: {
    files: 1,
    edges: 0,
    symbolEdges: 0,
    externalEdges: 0,
    builtinEdges: 0,
    namespaceEdges: 0,
    unresolvedImports: 0,
    filesByZone: {},
    unclassifiedFiles: 0,
  },
});

const violation = (message: string, start: number) => ({
  severity: "error" as const,
  message,
  file: join(ROOT, "src/engine/runner.ts"),
  start,
});

const claimOf = (message: string, start = 10) =>
  reportOf([{ claim: "every-import-respects-its-zone-boundary", findings: [violation(message, start)] }]);

const severitiesOf = (report: Report): string[] =>
  report.claims
    .filter((claim) => claim.claim !== STALE_CLAIM)
    .flatMap((claim) => claim.findings.map((finding) => finding.severity));

const staleOf = (report: Report): readonly string[] =>
  report.claims.find((claim) => claim.claim === STALE_CLAIM)?.findings.map((finding) => finding.message) ?? [];

describe("a baseline", () => {
  it("records a finding without its position", () => {
    expect(baselineOf(claimOf("engine reaches domain"), ROOT).entries).toEqual([
      {
        claim: "every-import-respects-its-zone-boundary",
        file: "src/engine/runner.ts",
        message: "engine reaches domain",
      },
    ]);
  });

  it("still matches a finding after the line it sits on has moved", () => {
    const baseline = baselineOf(claimOf("engine reaches domain", 10), ROOT);
    const moved = applyBaseline({ report: claimOf("engine reaches domain", 4096), baseline, root: ROOT });

    expect(severitiesOf(moved.report)).toEqual(["warning"]);
    expect(moved.known).toBe(1);
    expect(moved.stale).toBe(0);
  });

  it("leaves a violation it never recorded as an error", () => {
    const baseline = baselineOf(claimOf("engine reaches domain"), ROOT);
    const other = applyBaseline({ report: claimOf("engine reaches persistence"), baseline, root: ROOT });

    expect(severitiesOf(other.report)).toEqual(["error"]);
    expect(other.known).toBe(0);
  });

  it("names an entry whose violation is gone so the list cannot rot", () => {
    const baseline = baselineOf(claimOf("engine reaches domain"), ROOT);
    const fixed = applyBaseline({ report: reportOf([]), baseline, root: ROOT });

    expect(fixed.stale).toBe(1);
    expect(staleOf(fixed.report)[0]).toContain("engine reaches domain");
  });

  it("refuses to record a broken analysis", () => {
    const broken = reportOf([
      { claim: "the-analysis-reached-files", findings: [{ severity: "error", message: "no files were analysed", file: null, start: null }] },
    ]);

    expect(baselineOf(broken, ROOT).entries).toEqual([]);
  });

  it("keeps a broken analysis failing even when an entry claims to cover it", () => {
    const broken = reportOf([
      { claim: "the-analysis-reached-files", findings: [{ severity: "error", message: "no files were analysed", file: null, start: null }] },
    ]);
    const forged: Baseline = {
      entries: [{ claim: "the-analysis-reached-files", file: null, message: "no files were analysed" }],
    };

    expect(severitiesOf(applyBaseline({ report: broken, baseline: forged, root: ROOT }).report)).toEqual(["error"]);
  });

  it("records each distinct violation once and in a stable order", () => {
    const many = reportOf([
      { claim: "b-claim", findings: [violation("second", 1), violation("second", 2)] },
      { claim: "a-claim", findings: [violation("first", 3)] },
    ]);

    expect(baselineOf(many, ROOT).entries.map((entry) => `${entry.claim} ${entry.message}`)).toEqual([
      "a-claim first",
      "b-claim second",
    ]);
  });
});

const PROJECT = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "project");
const BASELINE = baselinePathIn(PROJECT);

const runIn = async (argv: readonly string[]): Promise<{ code: number; output: string }> => {
  let output = "";
  const code = await runCli({ cwd: PROJECT, argv, write: (line) => (output += `${line}\n`) });
  return { code, output };
};

describe("adopting the ratchet from the command line", () => {
  afterEach(() => {
    if (existsSync(BASELINE)) rmSync(BASELINE);
  });

  it("fails on a fresh repository with no baseline", async () => {
    const { code, output } = await runIn([]);
    expect(code).toBe(EXIT_ERRORS);
    expect(output).toContain("may not reach domain");
  });

  it("accepts the current findings into a baseline file", async () => {
    expect((await runIn(["--update-baseline"])).code).toBe(EXIT_CLEAN);
    expect(readBaseline(BASELINE).entries).toHaveLength(1);
  });

  it("passes afterwards, reporting the violation as known rather than hiding it", async () => {
    await runIn(["--update-baseline"]);
    const { code, output } = await runIn([]);

    expect(code).toBe(EXIT_CLEAN);
    expect(output).toContain("1 known · 0 stale");
    expect(output).toContain("may not reach domain");
  });

  it("exits apart from both clean and failing when an entry has gone stale", async () => {
    await runIn(["--update-baseline"]);
    const accepted = readBaseline(BASELINE);
    writeBaseline(BASELINE, {
      entries: [
        ...accepted.entries,
        {
          claim: "every-import-respects-its-zone-boundary",
          file: "src/engine/runner.ts",
          message: "a violation that was fixed long ago",
        },
      ],
    });

    const { code, output } = await runIn([]);

    expect(code).toBe(EXIT_STALE_BASELINE);
    expect(code).not.toBe(EXIT_ERRORS);
    expect(output).toContain("drop it from the baseline");
  });
});
