import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { reasonOf } from "../support/report.ts";
import { fallowRunner } from "../../src/adapters/fallow-runner.ts";
import type { RunnerOutcome } from "../../src/ports/runner.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "fixtures", "project");
const TOOL = join(HERE, "..", "fixtures", "fake-tool", "tool.mjs");

const runWith = (mode: string, categories?: readonly string[]): RunnerOutcome =>
  fallowRunner({
    command: ["node", TOOL, mode],
    ...(categories === undefined ? {} : { categories }),
  }).run(ROOT);

describe("reading a delegated tool's output", () => {
  it("reports a finding per entry in a requested category", () => {
    const outcome = runWith("ok", ["unused_exports"]);
    expect(outcome.kind).toBe("findings");
    expect(outcome.kind === "findings" && outcome.findings).toEqual([
      {
        category: "unused_exports",
        message: "unused exports: run",
        file: join(ROOT, "src/engine/runner.ts"),
        start: 58,
        severity: "error",
      },
    ]);
  });

  it("turns the reported line and column into an offset landing on the named symbol", () => {
    const outcome = runWith("ok", ["unused_exports"]);
    const start = outcome.kind === "findings" ? (outcome.findings[0]?.start ?? 0) : 0;
    const source = readFileSync(join(ROOT, "src/engine/runner.ts"), "utf8");

    expect(source.slice(start, start + 3)).toBe("run");
  });

  it("ignores a category that was not asked for", () => {
    const outcome = runWith("ok", ["unused_exports"]);
    expect(outcome.kind === "findings" && outcome.findings.map((f) => f.category)).toEqual([
      "unused_exports",
    ]);
  });

  it("describes a cycle by its members", () => {
    const outcome = runWith("ok", ["circular_dependencies"]);
    expect(outcome.kind === "findings" && outcome.findings[0]?.message).toBe(
      "circular dependencies: a.ts -> b.ts",
    );
  });
});

describe("refusing to trust a delegated tool", () => {
  it("fails when the output schema is not the one it was written against", () => {
    expect(reasonOf(runWith("old-schema"))).toContain("is not the expected 9");
  });

  it("fails when the output carries no check section", () => {
    expect(reasonOf(runWith("no-check"))).toContain("no check section");
  });

  it("fails when the output is not JSON", () => {
    expect(reasonOf(runWith("not-json"))).toContain("not JSON");
  });

  it("fails when the tool printed nothing", () => {
    expect(reasonOf(runWith("silent"))).toContain("no output");
  });

  it("fails when the command does not exist", () => {
    const outcome = fallowRunner({ command: ["definitely-not-a-real-binary-xyz"] }).run(ROOT);
    expect(outcome.kind).toBe("failed");
  });

  it("fails when no command was configured at all", () => {
    expect(reasonOf(fallowRunner({ command: [] }).run(ROOT))).toContain("no command");
  });
});
