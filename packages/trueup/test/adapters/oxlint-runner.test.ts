import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { oxlintRunner } from "../../src/adapters/oxlint-runner.ts";
import type { RunnerOutcome } from "../../src/ports/runner.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { findingsOf, reasonOf } from "../support/report.ts";

const ROOT = fixtureAt("project");
const TOOL = join(fixtureAt("fake-tool"), "oxlint.mjs");
const LINTED = join(ROOT, "src/engine/runner.ts");

const runWith = (mode: string, categories?: readonly string[]): Promise<RunnerOutcome> =>
  oxlintRunner({
    command: ["node", TOOL, mode],
    ...(categories === undefined ? {} : { categories }),
  }).run(ROOT);

describe("reading oxlint's output", () => {
  it("makes the scope and rule its own category", async () => {
    expect(findingsOf(await runWith("ok")).map((finding) => finding.category)).toContain("eslint/max-params");
  });

  it("keeps a code that carries no scope rather than dropping the finding", async () => {
    expect(findingsOf(await runWith("ok")).map((finding) => finding.category)).toContain("oxc/bad-shape");
  });

  it("resolves the path it echoes, which is relative to the root it was given", async () => {
    expect(findingsOf(await runWith("ok"))[0]?.file).toBe(LINTED);
  });

  it("takes the offset from the label rather than recomputing it from line and column", async () => {
    expect(findingsOf(await runWith("ok"))[0]?.start).toBe(41);
  });

  it("keeps the tool's own severity", async () => {
    const severities = findingsOf(await runWith("ok")).map((finding) => finding.severity);
    expect(severities).toEqual(["error", "warning", "error"]);
  });

  it("narrows to the categories asked for, by prefix", async () => {
    const findings = findingsOf(await runWith("ok", ["eslint"]));
    expect(findings.map((finding) => finding.category)).toEqual(["eslint/max-params"]);
  });

  it("matches a filter naming a rule exactly, not only a scope above it", async () => {
    expect(findingsOf(await runWith("ok", ["oxc/bad-shape"])).map((f) => f.category)).toEqual([
      "oxc/bad-shape",
    ]);
  });

  it("keeps what any one filter matches, rather than only what they all match", async () => {
    expect(findingsOf(await runWith("ok", ["eslint", "typescript"])).map((f) => f.category)).toEqual([
      "eslint/max-params",
      "typescript/no-explicit-any",
    ]);
  });

  it("asks oxlint for json over the whole tree, and nothing else", async () => {
    expect(findingsOf(await runWith("report-args"))[0]?.message).toBe("--format json .");
  });

  it("asks oxlint to fix what it can first, so an autofixable finding is not reported", async () => {
    const outcome = await oxlintRunner({ command: ["node", TOOL, "report-args"], write: true }).run(ROOT);

    expect(findingsOf(outcome)[0]?.message).toBe("--fix --format json .");
  });

  it("leaves the tree alone unless the project asked it to write", async () => {
    const outcome = await oxlintRunner({ command: ["node", TOOL, "report-args"], write: false }).run(ROOT);

    expect(findingsOf(outcome)[0]?.message).toBe("--format json .");
  });

  it("carries the name oxlint's findings are reported under", () => {
    expect(oxlintRunner().name).toBe("oxlint");
  });
});

describe("a diagnostic oxlint left incomplete", () => {
  const odd = async () => findingsOf(await runWith("odd-diagnostics"));

  it("drops what carries no code or no message, keeping the rest", async () => {
    expect((await odd()).map((finding) => finding.category)).toEqual([
      "oxc/no-labels",
      "oxc/empty-labels",
      "oxc/label-no-span",
    ]);
  });

  it("reports no position for a diagnostic pointing at nothing", async () => {
    expect((await odd()).map((finding) => finding.start)).toEqual([null, null, null]);
  });
});

describe("distrusting oxlint", () => {
  it("fails on a tool that printed nothing", async () => {
    expect(reasonOf(await runWith("silent"))).toContain("no output");
  });

  it("fails on output that is not JSON", async () => {
    expect(reasonOf(await runWith("not-json"))).toBe("output was not JSON");
  });

  it("fails when the payload carries no diagnostics at all", async () => {
    expect(reasonOf(await runWith("no-diagnostics-key"))).toBe("output carried no diagnostics");
  });

  it("fails when the tool will not say how many files it read", async () => {
    expect(reasonOf(await runWith("no-count"))).toContain("how many files");
  });

  it("fails on a clean report over nothing, which exits the same as a clean report", async () => {
    expect(reasonOf(await runWith("no-files"))).toContain("no files to lint");
  });

  it("fails rather than reporting nothing found when the binary is missing", async () => {
    const outcome = await oxlintRunner({ command: ["./no-such-oxlint"] }).run(ROOT);
    expect(outcome.kind).toBe("failed");
  });
});

describe("a category oxlint can never report", () => {
  it("fails when no enabled rule falls under it", async () => {
    expect(reasonOf(await runWith("ok", ["nowhere"]))).toContain("can never report: nowhere");
  });

  it("names every such category, rather than stopping at the first", async () => {
    expect(reasonOf(await runWith("ok", ["nowhere", "nothing"]))).toContain("nowhere, nothing");
  });

  it("fails when the rule under it is switched off in oxlint's own config", async () => {
    expect(reasonOf(await runWith("rule-off", ["oxc/bad-shape"]))).toContain("can never report");
  });

  it("counts a rule oxlint only warns on as able to report", async () => {
    expect(findingsOf(await runWith("ok", ["typescript"])).map((f) => f.category)).toEqual([
      "typescript/no-explicit-any",
    ]);
  });

  it("fails when the resolved config says nothing rather than trusting the filter", async () => {
    expect(reasonOf(await runWith("config-silent", ["eslint"]))).toContain("unreadable");
  });

  it("fails when the resolved config carries no rules at all", async () => {
    expect(reasonOf(await runWith("config-no-rules", ["eslint"]))).toContain("unreadable");
  });

  it("leaves the resolved config unread when the runner was given no categories", async () => {
    expect(findingsOf(await runWith("config-silent"))).not.toEqual([]);
  });
});
