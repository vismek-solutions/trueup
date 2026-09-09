import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findingsOf, reasonOf } from "../support/report.ts";
import { biomeRunner } from "../../src/adapters/biome-runner.ts";
import type { RunnerOutcome } from "../../src/ports/runner.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "fixtures", "project");
const TOOL = join(HERE, "..", "fixtures", "fake-tool", "biome.mjs");
const LINTED = join(ROOT, "src/engine/runner.ts");

const runWith = (mode: string, categories?: readonly string[]): RunnerOutcome =>
  biomeRunner({
    command: ["node", TOOL, mode],
    ...(categories === undefined ? {} : { categories }),
  }).run(ROOT);

describe("reading biome's output", () => {
  it("keeps biome's full rule path as the category", () => {
    expect(findingsOf(runWith("ok")).map((finding) => finding.category)).toEqual([
      "lint/suspicious/noDoubleEquals",
      "lint/style/useConst",
      "deserialize",
    ]);
  });

  it("maps biome's severity names onto the two this tool has", () => {
    expect(findingsOf(runWith("ok")).map((finding) => finding.severity)).toEqual([
      "error",
      "warning",
      "warning",
    ]);
  });

  it("turns the one-based column into an offset landing on the reported symbol", () => {
    const start = findingsOf(runWith("ok"))[0]?.start ?? 0;
    expect(readFileSync(LINTED, "utf8").slice(start, start + 3)).toBe("run");
  });

  it("reports no position for a diagnostic about a whole file", () => {
    expect(findingsOf(runWith("ok"))[2]?.start).toBeNull();
  });

  it("keeps a diagnostic biome placed in no file at all", () => {
    expect(findingsOf(runWith("unlocated-lint"))[0]).toMatchObject({ file: null, start: null });
  });

  it("keeps a diagnostic biome placed in a file but at no line", () => {
    expect(findingsOf(runWith("unpositioned-lint"))[0]).toMatchObject({ file: LINTED, start: null });
  });

  it("carries the name biome's findings are reported under", () => {
    expect(biomeRunner().name).toBe("biome");
  });

  it("matches a category filter by prefix, so one entry keeps a whole group", () => {
    expect(findingsOf(runWith("ok", ["lint/style"])).map((finding) => finding.category)).toEqual([
      "lint/style/useConst",
    ]);
  });

  it("matches a filter naming a rule exactly, not only a group above it", () => {
    expect(findingsOf(runWith("ok", ["deserialize"])).map((finding) => finding.category)).toEqual([
      "deserialize",
    ]);
  });

  it("keeps what any one filter matches, rather than only what they all match", () => {
    const found = runWith("ok", ["lint/style", "nothing/here"]);

    expect(findingsOf(found).map((finding) => finding.category)).toEqual(["lint/style/useConst"]);
  });

  it("shows the rule name when biome sent no message to show", () => {
    expect(findingsOf(runWith("terse"))[0]?.message).toBe("lint/style/useConst");
  });

  it("shows the rule name when the message is not text at all", () => {
    expect(findingsOf(runWith("shapeless-message"))[0]?.message).toBe("lint/style/useConst");
  });

  it("puts a message spread over lines onto one, trimmed and without the blanks", () => {
    expect(findingsOf(runWith("banner-message"))[0]?.message).toBe("headline detail");
  });

  it("keeps a message that is exactly as long as one may be", () => {
    expect(findingsOf(runWith("longest-message"))[0]?.message).toBe("a".repeat(300));
  });

  it("cuts a message one longer than that, and marks that it did", () => {
    const message = findingsOf(runWith("long-message"))[0]?.message ?? "";

    expect(message).toBe(`${"a".repeat(300)}…`);
  });

  it("keeps every lint rule under a single lint filter", () => {
    expect(findingsOf(runWith("ok", ["lint"])).map((finding) => finding.category)).toEqual([
      "lint/suspicious/noDoubleEquals",
      "lint/style/useConst",
    ]);
  });

  it("treats a diagnostics exit code as a normal result", () => {
    expect(runWith("ok").kind).toBe("findings");
  });

  it("resolves a path biome reported relative to the root", () => {
    const finding = findingsOf(runWith("relative-paths"))[0];

    expect(finding?.file).toBe(LINTED);
    expect(readFileSync(LINTED, "utf8").slice(finding?.start ?? 0, (finding?.start ?? 0) + 3)).toBe("run");
  });
});

describe("letting biome fix what it can", () => {
  const argsFor = (options: { readonly write?: boolean }): string =>
    findingsOf(biomeRunner({ command: ["node", TOOL, "report-args"], ...options }).run(ROOT))[0]?.message ??
    "";

  it("asks for json, a ceiling on diagnostics and the whole tree, and nothing else", () => {
    expect(argsFor({})).toBe("--reporter=json --max-diagnostics=10000 .");
  });

  it("leaves the working tree alone unless asked", () => {
    expect(argsFor({})).not.toContain("--write");
  });

  it("asks biome to apply its safe fixes when told to", () => {
    expect(argsFor({ write: true })).toContain("--write");
  });

  it("still reports what biome could not fix", () => {
    expect(findingsOf(runWith("ok")).length).toBeGreaterThan(0);
  });
});

describe("refusing to trust biome", () => {
  it("fails when biome processed no files, which its exit code alone does not say", () => {
    expect(reasonOf(runWith("no-files"))).toContain("processed no files");
  });

  it("lists every path it searched, so the empty run can be reproduced", () => {
    const found = biomeRunner({ command: ["node", TOOL, "no-files"], paths: ["src", "test"] }).run(ROOT);

    expect(reasonOf(found)).toContain("processed no files under src test");
  });

  it("adds the two counts rather than comparing them, so an equal run is not read as empty", () => {
    expect(runWith("churn").kind).toBe("findings");
  });

  it("fails when the summary is missing a count, rather than reading it as none", () => {
    expect(reasonOf(runWith("half-summary"))).toContain("summary and diagnostics");
  });

  it("fails on either count being missing, not only the first", () => {
    expect(reasonOf(runWith("no-unchanged"))).toContain("summary and diagnostics");
  });

  it("fails when biome withheld diagnostics rather than under-reporting them", () => {
    expect(reasonOf(runWith("withheld"))).toContain("withheld 3 diagnostics");
  });

  it("fails when a diagnostic is not an object at all", () => {
    expect(reasonOf(runWith("not-a-diagnostic"))).toContain("summary and diagnostics");
  });

  it("fails when a diagnostic carries no category to report it under", () => {
    expect(reasonOf(runWith("no-category"))).toContain("summary and diagnostics");
  });

  it("fails when a file could not be parsed, naming the file", () => {
    expect(reasonOf(runWith("parse-error"))).toContain(`${LINTED} was not checked`);
  });

  it("says a file went unchecked even when biome named none", () => {
    expect(reasonOf(runWith("unlocated-parse-error"))).toContain("a file was not checked");
  });

  it("fails on an internal error rather than passing it off as a finding", () => {
    expect(reasonOf(runWith("internal-error"))).toContain("was not checked");
  });

  it("fails on a severity it does not recognise", () => {
    expect(reasonOf(runWith("bad-severity"))).toContain("unrecognised severity");
  });

  it("fails on an unparseable file even when the category filter excludes it", () => {
    expect(reasonOf(runWith("parse-error", ["lint"]))).toContain("was not checked");
  });

  it("fails when the output is not JSON", () => {
    expect(reasonOf(runWith("not-json"))).toContain("not JSON");
  });

  it("fails when the output carries no summary", () => {
    expect(reasonOf(runWith("no-summary"))).toContain("summary and diagnostics");
  });

  it("fails when biome printed nothing", () => {
    expect(reasonOf(runWith("silent"))).toContain("no output");
  });

  it("reads whitespace alone as nothing printed, rather than trying to parse it", () => {
    expect(reasonOf(runWith("whitespace"))).toBe("no output (exit 1)");
  });

  it("carries what biome said on the way out when it said nothing on the way in", () => {
    expect(reasonOf(runWith("stderr-only"))).toBe("no output (exit 2): biome could not start");
  });

  it("fails when the output is json but not an object to read fields from", () => {
    expect(reasonOf(runWith("null-json"))).toBe("output was not a JSON object");
  });

  it("fails when the process was killed rather than reporting an empty run", () => {
    expect(reasonOf(runWith("killed"))).toBe("the process was killed before it finished");
  });

  it("fails when the command does not exist, saying which one", () => {
    const outcome = biomeRunner({ command: ["definitely-not-a-real-binary-xyz"] }).run(ROOT);

    expect(reasonOf(outcome)).toContain("definitely-not-a-real-binary-xyz");
  });

  it("fails when no command was configured at all", () => {
    expect(reasonOf(biomeRunner({ command: [] }).run(ROOT))).toContain("no command");
  });
});
