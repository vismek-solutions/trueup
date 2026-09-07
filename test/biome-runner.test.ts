import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { biomeRunner } from "../src/adapters/biome-runner.ts";
import type { RunnerOutcome } from "../src/ports/runner.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "fixtures", "project");
const TOOL = join(HERE, "fixtures", "fake-tool", "biome.mjs");
const LINTED = join(ROOT, "src/engine/runner.ts");

const runWith = (mode: string, categories?: readonly string[]): RunnerOutcome =>
  biomeRunner({
    command: ["node", TOOL, mode],
    ...(categories === undefined ? {} : { categories }),
  }).run(ROOT);

const findingsOf = (outcome: RunnerOutcome) => (outcome.kind === "findings" ? outcome.findings : []);
const reasonOf = (outcome: RunnerOutcome): string => (outcome.kind === "failed" ? outcome.reason : "");

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

  it("matches a category filter by prefix, so one entry keeps a whole group", () => {
    expect(findingsOf(runWith("ok", ["lint/style"])).map((finding) => finding.category)).toEqual([
      "lint/style/useConst",
    ]);
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

  it("fails when biome withheld diagnostics rather than under-reporting them", () => {
    expect(reasonOf(runWith("withheld"))).toContain("withheld 3 diagnostics");
  });

  it("fails when a file could not be parsed", () => {
    expect(reasonOf(runWith("parse-error"))).toContain("was not checked");
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

  it("fails when the command does not exist", () => {
    expect(biomeRunner({ command: ["definitely-not-a-real-binary-xyz"] }).run(ROOT).kind).toBe("failed");
  });

  it("fails when no command was configured at all", () => {
    expect(reasonOf(biomeRunner({ command: [] }).run(ROOT))).toContain("no command");
  });
});
