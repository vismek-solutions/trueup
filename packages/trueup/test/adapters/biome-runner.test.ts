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

const runWith = (mode: string): Promise<RunnerOutcome> =>
  biomeRunner({ command: ["node", TOOL, mode] }).run(ROOT);

describe("reading biome's output", () => {
  it("keeps biome's full rule path as the category", async () => {
    expect(findingsOf(await runWith("ok")).map((finding) => finding.category)).toEqual([
      "lint/suspicious/noDoubleEquals",
      "lint/style/useConst",
      "deserialize",
    ]);
  });

  it("maps biome's severity names onto the two this tool has", async () => {
    expect(findingsOf(await runWith("ok")).map((finding) => finding.severity)).toEqual([
      "error",
      "warning",
      "warning",
    ]);
  });

  it("turns the one-based column into an offset landing on the reported symbol", async () => {
    const start = findingsOf(await runWith("ok"))[0]?.start ?? 0;
    expect(readFileSync(LINTED, "utf8").slice(start, start + 3)).toBe("run");
  });

  it("reports no position for a diagnostic about a whole file", async () => {
    expect(findingsOf(await runWith("ok"))[2]?.start).toBeNull();
  });

  it("reports no position for a line before the first, since no byte sits there", async () => {
    expect(findingsOf(await runWith("edge-positions"))[0]?.start).toBeNull();
  });

  it("reports no position in a file it cannot read, rather than an offset into a file that is absent", async () => {
    expect(findingsOf(await runWith("edge-positions"))[1]?.start).toBeNull();
  });

  it("places a line past the last one just past the last byte, counting no line that is absent", async () => {
    expect(findingsOf(await runWith("edge-positions"))[2]?.start).toBe(
      readFileSync(LINTED, "utf8").length + 1,
    );
  });

  it("keeps a diagnostic biome placed in no file at all", async () => {
    expect(findingsOf(await runWith("unlocated-lint"))[0]).toMatchObject({ file: null, start: null });
  });

  it("keeps a diagnostic biome placed in a file but at no line", async () => {
    expect(findingsOf(await runWith("unpositioned-lint"))[0]).toMatchObject({ file: LINTED, start: null });
  });

  it("keeps a diagnostic placed at a line in a file it could not read a name for", async () => {
    expect(findingsOf(await runWith("unnamed-position"))[0]).toMatchObject({ file: null, start: null });
  });

  it("carries the name biome's findings are reported under", () => {
    expect(biomeRunner().name).toBe("biome");
  });

  it("shows the rule name when biome sent no message to show", async () => {
    expect(findingsOf(await runWith("terse"))[0]?.message).toBe("lint/style/useConst");
  });

  it("shows the rule name when the message is not text at all", async () => {
    expect(findingsOf(await runWith("shapeless-message"))[0]?.message).toBe("lint/style/useConst");
  });

  it("puts a message spread over lines onto one, trimmed and without the blanks", async () => {
    expect(findingsOf(await runWith("banner-message"))[0]?.message).toBe("headline detail");
  });

  it("keeps a message that is exactly as long as one may be", async () => {
    expect(findingsOf(await runWith("longest-message"))[0]?.message).toBe("a".repeat(300));
  });

  it("cuts a message one longer than that, and marks that it did", async () => {
    const message = findingsOf(await runWith("long-message"))[0]?.message ?? "";

    expect(message).toBe(`${"a".repeat(300)}…`);
  });

  it("treats a diagnostics exit code as a normal result", async () => {
    expect((await runWith("ok")).kind).toBe("findings");
  });

  it("resolves a path biome reported relative to the root", async () => {
    const finding = findingsOf(await runWith("relative-paths"))[0];

    expect(finding?.file).toBe(LINTED);
    expect(readFileSync(LINTED, "utf8").slice(finding?.start ?? 0, (finding?.start ?? 0) + 3)).toBe("run");
  });
});

describe("letting biome fix what it can", () => {
  const argsFor = async (options: { readonly write?: boolean }): Promise<string> =>
    findingsOf(await biomeRunner({ command: ["node", TOOL, "report-args"], ...options }).run(ROOT))[0]
      ?.message ?? "";

  it("asks for json, a ceiling on diagnostics and the whole tree, and nothing else", async () => {
    expect(await argsFor({})).toBe("--reporter=json --max-diagnostics=10000 .");
  });

  it("leaves the working tree alone unless asked", async () => {
    expect(await argsFor({})).not.toContain("--write");
  });

  it("asks biome to apply its safe fixes when told to", async () => {
    expect(await argsFor({ write: true })).toContain("--write");
  });

  it("still reports what biome could not fix", async () => {
    expect(findingsOf(await runWith("ok")).length).toBeGreaterThan(0);
  });
});

describe("refusing to trust biome", () => {
  it("fails when biome processed no files, which its exit code alone does not say", async () => {
    expect(reasonOf(await runWith("no-files"))).toContain("processed no files");
  });

  it("lists every path it searched, so the empty run can be reproduced", async () => {
    const found = await biomeRunner({ command: ["node", TOOL, "no-files"], paths: ["src", "test"] }).run(
      ROOT,
    );

    expect(reasonOf(found)).toContain("processed no files under src test");
  });

  it("adds the two counts rather than comparing them, so an equal run is not read as empty", async () => {
    expect((await runWith("churn")).kind).toBe("findings");
  });

  it("fails when the summary is missing a count, rather than reading it as none", async () => {
    expect(reasonOf(await runWith("half-summary"))).toContain("summary and diagnostics");
  });

  it("fails on either count being missing, not only the first", async () => {
    expect(reasonOf(await runWith("no-unchanged"))).toContain("summary and diagnostics");
  });

  it("fails when biome withheld diagnostics rather than under-reporting them", async () => {
    expect(reasonOf(await runWith("withheld"))).toContain("withheld 3 diagnostics");
  });

  it("fails when a diagnostic is not an object at all", async () => {
    expect(reasonOf(await runWith("not-a-diagnostic"))).toContain("summary and diagnostics");
  });

  it("fails when a diagnostic carries no category to report it under", async () => {
    expect(reasonOf(await runWith("no-category"))).toContain("summary and diagnostics");
  });

  it("fails when a file could not be parsed, naming the file", async () => {
    expect(reasonOf(await runWith("parse-error"))).toContain(`${LINTED} was not checked`);
  });

  it("says a file went unchecked even when biome named none", async () => {
    expect(reasonOf(await runWith("unlocated-parse-error"))).toContain("a file was not checked");
  });

  it("fails on an internal error rather than passing it off as a finding", async () => {
    expect(reasonOf(await runWith("internal-error"))).toContain("was not checked");
  });

  it("fails on a severity it does not recognise", async () => {
    expect(reasonOf(await runWith("bad-severity"))).toContain("unrecognised severity");
  });

  it("fails when the output is not JSON", async () => {
    expect(reasonOf(await runWith("not-json"))).toContain("not JSON");
  });

  it("fails when the output carries no summary", async () => {
    expect(reasonOf(await runWith("no-summary"))).toContain("summary and diagnostics");
  });

  it("fails when biome printed nothing", async () => {
    expect(reasonOf(await runWith("silent"))).toContain("no output");
  });

  it("reads whitespace alone as nothing printed, rather than trying to parse it", async () => {
    expect(reasonOf(await runWith("whitespace"))).toBe("no output (exit 1)");
  });

  it("carries what biome said on the way out when it said nothing on the way in", async () => {
    expect(reasonOf(await runWith("stderr-only"))).toBe("no output (exit 2): biome could not start");
  });

  it("fails when the output is json but not an object to read fields from", async () => {
    expect(reasonOf(await runWith("null-json"))).toBe("output was not a JSON object");
  });

  it("fails when the process was killed rather than reporting an empty run", async () => {
    expect(reasonOf(await runWith("killed"))).toBe("the process was killed before it finished");
  });

  it("fails when the command does not exist, saying which one", async () => {
    const outcome = await biomeRunner({ command: ["definitely-not-a-real-binary-xyz"] }).run(ROOT);

    expect(reasonOf(outcome)).toContain("definitely-not-a-real-binary-xyz");
  });

  it("fails when no command was configured at all", async () => {
    expect(reasonOf(await biomeRunner({ command: [] }).run(ROOT))).toContain("no command");
  });
});
