import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyOfFixture, discard, fixtureAt } from "../support/fixtures.ts";
import { baselinePathIn, readBaseline, writeBaseline } from "../../src/adapters/baseline-file.ts";
import { EXIT_CLEAN, EXIT_ERRORS, EXIT_STALE_BASELINE } from "../../src/cli/command.ts";
import { runCli } from "../../src/cli/main.ts";
import type { Baseline } from "../../src/ports/baseline.ts";
import { applyBaseline, baselineOf, STALE_CLAIM } from "../../src/ratchet/apply.ts";
import type { Report } from "../../src/report/model.ts";

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
  reportOf([
    { claim: "every-import-respects-its-zone-boundary", guidance: "", findings: [violation(message, start)] },
  ]);

const severitiesOf = (report: Report): string[] =>
  report.claims
    .filter((claim) => claim.claim !== STALE_CLAIM)
    .flatMap((claim) => claim.findings.map((finding) => finding.severity));

const staleOf = (report: Report): readonly string[] =>
  report.claims.find((claim) => claim.claim === STALE_CLAIM)?.findings.map((finding) => finding.message) ??
  [];

const staleFindingsOf = (report: Report) =>
  report.claims.find((claim) => claim.claim === STALE_CLAIM)?.findings ?? [];

describe("a stale entry", () => {
  const baseline: Baseline = {
    entries: [
      { claim: "every-import-respects-its-zone-boundary", file: "src/engine/runner.ts", message: "gone" },
      { claim: "every-import-respects-its-zone-boundary", file: null, message: "no file" },
    ],
  };

  it("names the file whose violation is fixed, so identical messages stay apart", () => {
    const { report } = applyBaseline({ report: reportOf([]), baseline, root: ROOT });

    expect(staleFindingsOf(report).map((finding) => finding.file)).toEqual([
      join(ROOT, "src/engine/runner.ts"),
      null,
    ]);
  });
});

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
      {
        claim: "the-analysis-reached-files",
        guidance: "",
        findings: [{ severity: "error", message: "no files were analysed", file: null, start: null }],
      },
    ]);

    expect(baselineOf(broken, ROOT).entries).toEqual([]);
  });

  it("keeps a broken analysis failing even when an entry claims to cover it", () => {
    const broken = reportOf([
      {
        claim: "the-analysis-reached-files",
        guidance: "",
        findings: [{ severity: "error", message: "no files were analysed", file: null, start: null }],
      },
    ]);
    const forged: Baseline = {
      entries: [{ claim: "the-analysis-reached-files", file: null, message: "no files were analysed" }],
    };

    expect(severitiesOf(applyBaseline({ report: broken, baseline: forged, root: ROOT }).report)).toEqual([
      "error",
    ]);
  });

  it("records each distinct violation once and in a stable order", () => {
    const many = reportOf([
      { claim: "b-claim", guidance: "", findings: [violation("second", 1), violation("second", 2)] },
      { claim: "a-claim", guidance: "", findings: [violation("first", 3)] },
    ]);

    expect(baselineOf(many, ROOT).entries.map((entry) => `${entry.claim} ${entry.message}`)).toEqual([
      "a-claim first",
      "b-claim second",
    ]);
  });
});

const UNRATCHETED = fixtureAt("explained");

let PROJECT = "";
let BASELINE = "";

const runFrom = async (cwd: string, argv: readonly string[]) => {
  let output = "";
  const code = await runCli({ cwd, argv, write: (line) => (output += `${line}\n`) });
  return { code, output };
};

const runIn = (argv: readonly string[]) => runFrom(PROJECT, argv);

describe("a project that has never adopted the ratchet", () => {
  it("says nothing about baseline entries, since there is no list to keep honest", async () => {
    expect((await runFrom(UNRATCHETED, [])).output).not.toContain("every-baseline-entry-is-still-needed");
  });

  it("exits clean, so an absent baseline cannot read as a failing one", async () => {
    expect((await runFrom(UNRATCHETED, [])).code).toBe(EXIT_CLEAN);
  });
});

describe("adopting the ratchet from the command line", () => {
  beforeEach(() => {
    PROJECT = copyOfFixture("project");
    BASELINE = baselinePathIn(PROJECT);
  });

  afterEach(() => {
    discard(PROJECT);
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

  it("says how many findings it took and the file it put them in", async () => {
    expect((await runIn(["--update-baseline"])).output).toContain(
      "accepted 1 findings into trueup.baseline.json",
    );
  });

  it("fails on a violation the baseline never recorded, whatever else the baseline holds", async () => {
    writeBaseline(BASELINE, {
      entries: [
        {
          claim: "every-import-respects-its-zone-boundary",
          file: "src/engine/runner.ts",
          message: "a different violation entirely",
        },
      ],
    });

    expect((await runIn([])).code).toBe(EXIT_ERRORS);
  });

  it("passes afterwards, reporting the violation as known rather than hiding it", async () => {
    await runIn(["--update-baseline"]);
    const { code, output } = await runIn([]);

    expect(code).toBe(EXIT_CLEAN);
    expect(output).toContain("1 known · 0 stale");
    expect(output).toContain("may not reach domain");
  });

  it("offers a violation the baseline accepted, so the backlog needs no reading of the file", async () => {
    await runIn(["--update-baseline"]);
    const { output } = await runIn(["--next"]);

    expect(output).toContain("nothing failing");
    expect(output).toContain("baseline  1 of 1 accepted");
    expect(output).toContain("may not reach domain");
    expect(output).toContain("`trueup --update-baseline` to drop its entry");
  });

  it("keeps that a clean exit, since an accepted violation is not a failure", async () => {
    await runIn(["--update-baseline"]);

    expect((await runIn(["--next"])).code).toBe(EXIT_CLEAN);
  });

  it("offers the live error while there is no baseline holding it", async () => {
    expect((await runIn(["--next"])).output).toContain("problem 1 of");
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
    expect(output).toContain("no longer reports this");
  });
});
