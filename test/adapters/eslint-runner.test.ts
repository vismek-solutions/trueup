import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { eslintRunner } from "../../src/adapters/eslint-runner.ts";
import type { RunnerOutcome } from "../../src/ports/runner.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "fixtures", "project");
const TOOL = join(HERE, "..", "fixtures", "fake-tool", "eslint.mjs");
const LINTED = join(ROOT, "src/engine/runner.ts");

const runWith = (mode: string, categories?: readonly string[]): RunnerOutcome =>
  eslintRunner({
    command: ["node", TOOL, mode],
    ...(categories === undefined ? {} : { categories }),
  }).run(ROOT);

const runReportingSuppressed = (mode: string): RunnerOutcome =>
  eslintRunner({ command: ["node", TOOL, mode], reportSuppressed: true }).run(ROOT);

const findingsOf = (outcome: RunnerOutcome) => (outcome.kind === "findings" ? outcome.findings : []);
const reasonOf = (outcome: RunnerOutcome): string => (outcome.kind === "failed" ? outcome.reason : "");

describe("reading eslint's output", () => {
  it("makes each rule id its own category", () => {
    expect(findingsOf(runWith("ok")).map((finding) => finding.category)).toEqual([
      "no-unused-vars",
      "prefer-const",
    ]);
  });

  it("keeps eslint's own severity rather than forcing one", () => {
    expect(findingsOf(runWith("ok")).map((finding) => finding.severity)).toEqual(["error", "warning"]);
  });

  it("turns the one-based column into an offset landing on the reported symbol", () => {
    const start = findingsOf(runWith("ok"))[0]?.start ?? 0;
    expect(readFileSync(LINTED, "utf8").slice(start, start + 3)).toBe("run");
  });

  it("reports the file eslint named", () => {
    expect(findingsOf(runWith("ok"))[0]?.file).toBe(LINTED);
  });

  it("ignores a rule that was not asked for", () => {
    expect(findingsOf(runWith("ok", ["prefer-const"])).map((finding) => finding.category)).toEqual([
      "prefer-const",
    ]);
  });

  it("treats a lint failure exit code as a normal result", () => {
    expect(runWith("ok").kind).toBe("findings");
  });
});

describe("surfacing what an inline comment silenced", () => {
  it("says nothing about suppressed messages until asked", () => {
    expect(findingsOf(runWith("ok")).map((finding) => finding.category)).toEqual([
      "no-unused-vars",
      "prefer-const",
    ]);
  });

  it("keeps a suppressed rule apart from the same rule firing for real", () => {
    expect(findingsOf(runReportingSuppressed("ok")).map((finding) => finding.category)).toEqual([
      "no-unused-vars",
      "prefer-const",
      "suppressed/eqeqeq",
      "suppressed/no-console",
    ]);
  });

  it("carries the justification the author gave for silencing the rule", () => {
    const finding = findingsOf(runReportingSuppressed("ok")).at(-1);
    expect(finding?.message).toContain("needed for the CLI");
  });

  it("leaves a suppression with no justification stated plainly", () => {
    const finding = findingsOf(runReportingSuppressed("ok"))[2];
    expect(finding?.message).toBe("Expected '===' and instead saw '=='.");
  });

  it("fails rather than reporting none when eslint does not report suppressions at all", () => {
    expect(reasonOf(runReportingSuppressed("no-suppressed-field"))).toContain("does not report suppressed");
  });
});

describe("refusing to trust eslint", () => {
  it("fails when eslint linted no files at all", () => {
    expect(reasonOf(runWith("empty"))).toContain("linted no files");
  });

  it("fails when a file could not be parsed", () => {
    expect(reasonOf(runWith("fatal"))).toContain("could not be parsed");
  });

  it("fails on a configuration error rather than reporting nothing found", () => {
    expect(reasonOf(runWith("config-error"))).toContain("exit 2");
  });

  it("carries the reason past eslint's banner into the failure", () => {
    expect(reasonOf(runWith("config-error"))).toContain("couldn't find an eslint.config.js file");
  });

  it("fails when the output is not JSON", () => {
    expect(reasonOf(runWith("not-json"))).toContain("not JSON");
  });

  it("fails when the output is not an array of file results", () => {
    expect(reasonOf(runWith("not-array"))).toContain("array of file results");
  });

  it("fails when a file result carries no messages", () => {
    expect(reasonOf(runWith("bad-shape"))).toContain("array of file results");
  });

  it("fails when eslint printed nothing", () => {
    expect(reasonOf(runWith("silent"))).toContain("no output");
  });

  it("fails when the command does not exist", () => {
    expect(eslintRunner({ command: ["definitely-not-a-real-binary-xyz"] }).run(ROOT).kind).toBe("failed");
  });

  it("fails when no command was configured at all", () => {
    expect(reasonOf(eslintRunner({ command: [] }).run(ROOT))).toContain("no command");
  });
});
