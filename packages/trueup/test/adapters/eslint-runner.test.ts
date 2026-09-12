import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findingsOf, reasonOf } from "../support/report.ts";
import { eslintRunner } from "../../src/adapters/eslint-runner.ts";
import type { RunnerOutcome } from "../../src/ports/runner.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "fixtures", "project");
const TOOL = join(HERE, "..", "fixtures", "fake-tool", "eslint.mjs");
const LINTED = join(ROOT, "src/engine/runner.ts");

const runWith = (mode: string, categories?: readonly string[]): Promise<RunnerOutcome> =>
  eslintRunner({
    command: ["node", TOOL, mode],
    ...(categories === undefined ? {} : { categories }),
  }).run(ROOT);

const runReportingSuppressed = (mode: string): Promise<RunnerOutcome> =>
  eslintRunner({ command: ["node", TOOL, mode], reportSuppressed: true }).run(ROOT);

describe("reading eslint's output", () => {
  it("makes each rule id its own category", async () => {
    expect(findingsOf(await runWith("ok")).map((finding) => finding.category)).toEqual([
      "no-unused-vars",
      "prefer-const",
    ]);
  });

  it("keeps eslint's own severity rather than forcing one", async () => {
    expect(findingsOf(await runWith("ok")).map((finding) => finding.severity)).toEqual(["error", "warning"]);
  });

  it("turns the one-based column into an offset landing on the reported symbol", async () => {
    const start = findingsOf(await runWith("ok"))[0]?.start ?? 0;
    expect(readFileSync(LINTED, "utf8").slice(start, start + 3)).toBe("run");
  });

  it("reports the file eslint named", async () => {
    expect(findingsOf(await runWith("ok"))[0]?.file).toBe(LINTED);
  });

  it("ignores a rule that was not asked for", async () => {
    expect(findingsOf(await runWith("ok", ["prefer-const"])).map((finding) => finding.category)).toEqual([
      "prefer-const",
    ]);
  });

  it("treats a lint failure exit code as a normal result", async () => {
    expect((await runWith("ok")).kind).toBe("findings");
  });

  it("asks eslint for json over the whole tree, and nothing else", async () => {
    expect(findingsOf(await runWith("report-args"))[0]?.message).toBe(". --format json");
  });

  it("carries the name eslint's findings are reported under", () => {
    expect(eslintRunner().name).toBe("eslint");
  });
});

describe("a message eslint left incomplete", () => {
  const sparse = async () => findingsOf(await runWith("sparse"));

  it("files a message no rule claimed under a category saying so", async () => {
    expect((await sparse())[0]?.category).toBe("unattributed");
  });

  it("shows the rule name when eslint sent no message to show", async () => {
    expect((await sparse())[1]?.message).toBe("no-message");
  });

  it("reports no position when eslint gave no line", async () => {
    expect((await sparse())[0]?.start).toBeNull();
  });

  it("reads a line with no column as starting at the first one", async () => {
    const start = (await sparse())[2]?.start ?? 0;

    expect(readFileSync(LINTED, "utf8").slice(start, start + 6)).toBe("export");
  });
});

describe("surfacing what an inline comment silenced", () => {
  it("says nothing about suppressed messages until asked", async () => {
    expect(findingsOf(await runWith("ok")).map((finding) => finding.category)).toEqual([
      "no-unused-vars",
      "prefer-const",
    ]);
  });

  it("keeps a suppressed rule apart from the same rule firing for real", async () => {
    expect(findingsOf(await runReportingSuppressed("ok")).map((finding) => finding.category)).toEqual([
      "no-unused-vars",
      "prefer-const",
      "suppressed/eqeqeq",
      "suppressed/no-console",
    ]);
  });

  it("carries the justification the author gave for silencing the rule", async () => {
    const finding = findingsOf(await runReportingSuppressed("ok")).at(-1);
    expect(finding?.message).toContain("needed for the CLI");
  });

  it("leaves a suppression with no justification stated plainly", async () => {
    const finding = findingsOf(await runReportingSuppressed("ok"))[2];
    expect(finding?.message).toBe("Expected '===' and instead saw '=='.");
  });

  it("fails rather than reporting none when eslint does not report suppressions at all", async () => {
    expect(reasonOf(await runReportingSuppressed("no-suppressed-field"))).toContain(
      "does not report suppressed",
    );
  });

  it("states a suppression plainly when eslint recorded nothing about it", async () => {
    expect(findingsOf(await runReportingSuppressed("odd-suppressions"))[0]?.message).toBe(
      "silenced by nothing recorded",
    );
  });

  it("trims the justification and drops the ones that said nothing", async () => {
    expect(findingsOf(await runReportingSuppressed("odd-suppressions"))[1]?.message).toBe(
      "silenced once suppressed because: padded",
    );
  });

  it("joins two justifications rather than running them together", async () => {
    expect(findingsOf(await runReportingSuppressed("odd-suppressions"))[2]?.message).toBe(
      "silenced twice suppressed because: first; second",
    );
  });

  it("filters a suppressed rule by the category it is reported under", async () => {
    const found = await eslintRunner({
      command: ["node", TOOL, "ok"],
      reportSuppressed: true,
      categories: ["suppressed/no-console"],
    }).run(ROOT);

    expect(findingsOf(found).map((finding) => finding.category)).toEqual(["suppressed/no-console"]);
  });

  it("still fails on a parse error rather than going looking for suppressions", async () => {
    expect(reasonOf(await runReportingSuppressed("fatal"))).toContain("could not be parsed");
  });
});

describe("refusing to trust eslint", () => {
  it("fails when eslint linted no files at all", async () => {
    expect(reasonOf(await runWith("empty"))).toContain("linted no files");
  });

  it("lists every pattern it searched, so the empty run can be reproduced", async () => {
    const found = await eslintRunner({ command: ["node", TOOL, "empty"], patterns: ["src", "test"] }).run(
      ROOT,
    );

    expect(reasonOf(found)).toContain("linted no files under src test");
  });

  it("fails when a file result names no file", async () => {
    expect(reasonOf(await runWith("no-file-path"))).toContain("array of file results");
  });

  it("fails on a later file result, not only the first", async () => {
    expect(reasonOf(await runWith("second-bad"))).toContain("array of file results");
  });

  it("fails when a file could not be parsed", async () => {
    expect(reasonOf(await runWith("fatal"))).toContain("could not be parsed");
  });

  it("fails on a configuration error rather than reporting nothing found", async () => {
    expect(reasonOf(await runWith("config-error"))).toContain("exit 2");
  });

  it("carries the reason past eslint's banner into the failure", async () => {
    expect(reasonOf(await runWith("config-error"))).toContain("couldn't find an eslint.config.js file");
  });

  it("fails when the output is not JSON", async () => {
    expect(reasonOf(await runWith("not-json"))).toContain("not JSON");
  });

  it("fails when the output is not an array of file results", async () => {
    expect(reasonOf(await runWith("not-array"))).toContain("array of file results");
  });

  it("fails when a file result carries no messages", async () => {
    expect(reasonOf(await runWith("bad-shape"))).toContain("array of file results");
  });

  it("fails when eslint printed nothing", async () => {
    expect(reasonOf(await runWith("silent"))).toContain("no output");
  });

  it("reads whitespace alone as nothing printed, rather than trying to parse it", async () => {
    expect(reasonOf(await runWith("whitespace"))).toContain("no output");
  });

  it("fails when the command does not exist", async () => {
    expect((await eslintRunner({ command: ["definitely-not-a-real-binary-xyz"] }).run(ROOT)).kind).toBe(
      "failed",
    );
  });

  it("fails when no command was configured at all", async () => {
    expect(reasonOf(await eslintRunner({ command: [] }).run(ROOT))).toContain("no command");
  });
});
