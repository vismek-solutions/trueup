import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { oxlintRunner } from "../../src/adapters/oxlint-runner.ts";
import type { RunnerOutcome } from "../../src/ports/runner.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { findingsOf, reasonOf } from "../support/report.ts";

const ROOT = fixtureAt("project");
const TOOL = join(fixtureAt("fake-tool"), "oxlint.mjs");
const LINTED = join(ROOT, "src/engine/runner.ts");

const runWith = (mode: string, categories?: readonly string[]): RunnerOutcome =>
  oxlintRunner({
    command: ["node", TOOL, mode],
    ...(categories === undefined ? {} : { categories }),
  }).run(ROOT);

describe("reading oxlint's output", () => {
  it("makes the scope and rule its own category", () => {
    expect(findingsOf(runWith("ok")).map((finding) => finding.category)).toContain("eslint/max-params");
  });

  it("keeps a code that carries no scope rather than dropping the finding", () => {
    expect(findingsOf(runWith("ok")).map((finding) => finding.category)).toContain("oxc/bad-shape");
  });

  it("resolves the path it echoes, which is relative to the root it was given", () => {
    expect(findingsOf(runWith("ok"))[0]?.file).toBe(LINTED);
  });

  it("takes the offset from the label rather than recomputing it from line and column", () => {
    expect(findingsOf(runWith("ok"))[0]?.start).toBe(41);
  });

  it("keeps the tool's own severity", () => {
    const severities = findingsOf(runWith("ok")).map((finding) => finding.severity);
    expect(severities).toEqual(["error", "warning", "error"]);
  });

  it("narrows to the categories asked for, by prefix", () => {
    const findings = findingsOf(runWith("ok", ["eslint"]));
    expect(findings.map((finding) => finding.category)).toEqual(["eslint/max-params"]);
  });

  it("matches a filter naming a rule exactly, not only a scope above it", () => {
    expect(findingsOf(runWith("ok", ["oxc/bad-shape"])).map((f) => f.category)).toEqual(["oxc/bad-shape"]);
  });

  it("keeps what any one filter matches, rather than only what they all match", () => {
    expect(findingsOf(runWith("ok", ["eslint", "nothing"])).map((f) => f.category)).toEqual([
      "eslint/max-params",
    ]);
  });

  it("asks oxlint for json over the whole tree, and nothing else", () => {
    expect(findingsOf(runWith("report-args"))[0]?.message).toBe("--format json .");
  });

  it("asks oxlint to fix what it can first, so an autofixable finding is not reported", () => {
    const outcome = oxlintRunner({ command: ["node", TOOL, "report-args"], write: true }).run(ROOT);

    expect(findingsOf(outcome)[0]?.message).toBe("--fix --format json .");
  });

  it("leaves the tree alone unless the project asked it to write", () => {
    const outcome = oxlintRunner({ command: ["node", TOOL, "report-args"], write: false }).run(ROOT);

    expect(findingsOf(outcome)[0]?.message).toBe("--format json .");
  });

  it("carries the name oxlint's findings are reported under", () => {
    expect(oxlintRunner().name).toBe("oxlint");
  });
});

describe("a diagnostic oxlint left incomplete", () => {
  const odd = () => findingsOf(runWith("odd-diagnostics"));

  it("drops what carries no code or no message, keeping the rest", () => {
    expect(odd().map((finding) => finding.category)).toEqual([
      "oxc/no-labels",
      "oxc/empty-labels",
      "oxc/label-no-span",
    ]);
  });

  it("reports no position for a diagnostic pointing at nothing", () => {
    expect(odd().map((finding) => finding.start)).toEqual([null, null, null]);
  });
});

describe("distrusting oxlint", () => {
  it("fails on a tool that printed nothing", () => {
    expect(reasonOf(runWith("silent"))).toContain("no output");
  });

  it("fails on output that is not JSON", () => {
    expect(reasonOf(runWith("not-json"))).toBe("output was not JSON");
  });

  it("fails when the payload carries no diagnostics at all", () => {
    expect(reasonOf(runWith("no-diagnostics-key"))).toBe("output carried no diagnostics");
  });

  it("fails when the tool will not say how many files it read", () => {
    expect(reasonOf(runWith("no-count"))).toContain("how many files");
  });

  it("fails on a clean report over nothing, which exits the same as a clean report", () => {
    expect(reasonOf(runWith("no-files"))).toContain("no files to lint");
  });

  it("fails rather than reporting nothing found when the binary is missing", () => {
    const outcome = oxlintRunner({ command: ["./no-such-oxlint"] }).run(ROOT);
    expect(outcome.kind).toBe("failed");
  });
});
