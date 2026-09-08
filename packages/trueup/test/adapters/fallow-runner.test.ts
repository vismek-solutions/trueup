import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findingsOf, reasonOf } from "../support/report.ts";
import {
  DEFAULT_FALLOW_CATEGORIES,
  FALLOW_CATEGORIES,
  fallowRunner,
  type FallowDuplicationOptions,
} from "../../src/adapters/fallow-runner.ts";
import type { RunnerFinding, RunnerOutcome } from "../../src/ports/runner.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "fixtures", "project");
const TOOL = join(HERE, "..", "fixtures", "fake-tool", "tool.mjs");

const runWith = (mode: string, categories?: readonly string[]): RunnerOutcome =>
  fallowRunner({
    command: ["node", TOOL, mode],
    ...(categories === undefined ? {} : { categories }),
  }).run(ROOT);

const runDupes = (mode: string, duplication: FallowDuplicationOptions = {}): RunnerOutcome =>
  fallowRunner({ command: ["node", TOOL, mode], categories: ["unused_exports"], duplication }).run(ROOT);

const clonesOf = (outcome: RunnerOutcome): readonly RunnerFinding[] =>
  findingsOf(outcome).filter((finding) => finding.category === "code_duplication");

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

  it("names the category alone when the entry names no subject to hang it on", () => {
    expect(findingsOf(runWith("ok", ["a_category_fallow_added"]))).toEqual([
      {
        category: "a_category_fallow_added",
        message: "a category fallow added",
        file: null,
        start: null,
        severity: "error",
      },
    ]);
  });

  it("reports a category this version has no rule name for, rather than refusing the run", () => {
    expect(runWith("ok", ["a_category_fallow_added"]).kind).toBe("findings");
  });

  it("places nothing when the entry names a line but no file, and nothing when it names neither", () => {
    expect(findingsOf(runWith("ok", ["unused_types"]))).toEqual([
      {
        category: "unused_types",
        message: "unused types: Placeless",
        file: null,
        start: null,
        severity: "error",
      },
      {
        category: "unused_types",
        message: "unused types: Lineless",
        file: join(ROOT, "src/engine/runner.ts"),
        start: null,
        severity: "error",
      },
    ]);
  });
});

describe("reading a delegated tool's duplicate code", () => {
  it("reports every copy, each naming the others rather than the group", () => {
    expect(clonesOf(runDupes("named"))).toEqual([
      {
        category: "code_duplication",
        message: "7 lines written the same way at src/domain/thing.ts:1",
        file: join(ROOT, "src/engine/runner.ts"),
        start: 58,
        severity: "error",
        group: "a-fingerprint",
      },
      {
        category: "code_duplication",
        message: "7 lines written the same way at src/engine/runner.ts:3",
        file: join(ROOT, "src/domain/thing.ts"),
        start: 1,
        severity: "error",
        group: "a-fingerprint",
      },
    ]);
  });

  it("keys the copies together by the tool's fingerprint, so one problem stays one problem", () => {
    expect(clonesOf(runDupes("named")).map((finding) => finding.group)).toEqual([
      "a-fingerprint",
      "a-fingerprint",
    ]);
  });

  it("keys them by where they are when the tool named no fingerprint", () => {
    expect(clonesOf(runDupes("unnamed")).map((finding) => finding.group)).toEqual([
      "src/engine/runner.ts:3|src/domain/thing.ts:1",
      "src/engine/runner.ts:3|src/domain/thing.ts:1",
    ]);
  });

  it("drops a group whose copies it cannot place, rather than reporting one that names nowhere", () => {
    expect(clonesOf(runDupes("partial"))).toEqual([]);
  });

  it("drops a group where every copy is missing a line, not only one missing a file", () => {
    expect(clonesOf(runDupes("unplaceable"))).toEqual([]);
  });

  it("drops a group that carries no copies at all", () => {
    expect(clonesOf(runDupes("no-instances"))).toEqual([]);
  });

  it("leaves the other categories alone", () => {
    expect(findingsOf(runDupes("named")).map((finding) => finding.category)).toEqual([
      "unused_exports",
      "code_duplication",
      "code_duplication",
    ]);
  });

  it("reports no duplicates when none were asked for, even though the tool sent them", () => {
    const outcome = fallowRunner({ command: ["node", TOOL, "named"], categories: ["unused_exports"] }).run(
      ROOT,
    );

    expect(clonesOf(outcome)).toEqual([]);
  });

  it("asks the tool for the duplication settings it was given", () => {
    const outcome = fallowRunner({
      command: ["node", TOOL, "argv"],
      categories: ["unused_exports"],
      duplication: { mode: "weak", minLines: 5, minTokens: 30 },
    }).run(ROOT);

    expect(findingsOf(outcome).map((finding) => finding.message)).toEqual([
      "unused exports: --root",
      `unused exports: ${ROOT}`,
      "unused exports: --format",
      "unused exports: json",
      "unused exports: --quiet",
      "unused exports: --dupes-mode",
      "unused exports: weak",
      "unused exports: --dupes-min-lines",
      "unused exports: 5",
      "unused exports: --dupes-min-tokens",
      "unused exports: 30",
    ]);
  });

  it("asks for nothing it was not given", () => {
    const outcome = fallowRunner({
      command: ["node", TOOL, "argv"],
      categories: ["unused_exports"],
      duplication: { mode: "strict" },
    }).run(ROOT);

    const asked = findingsOf(outcome).map((finding) => finding.message);

    expect(asked).toContain("unused exports: strict");
    expect(asked.join(" ")).not.toContain("min-lines");
    expect(asked.join(" ")).not.toContain("min-tokens");
  });
});

describe("refusing to trust a delegated tool", () => {
  it("fails when duplication was asked for and the output carried no clone groups", () => {
    expect(reasonOf(runDupes("no-clone-groups"))).toContain("no clone groups");
  });

  it("fails when duplication was asked for and the output carried no dupes section at all", () => {
    expect(reasonOf(runDupes("ok"))).toContain("no clone groups");
  });

  it("fails when the output schema is not the one it was written against", () => {
    expect(reasonOf(runWith("old-schema"))).toContain("is not the expected 9");
  });

  it("fails when the output carries no check section", () => {
    expect(reasonOf(runWith("no-check"))).toContain("no check section");
  });

  it("fails when the output is not JSON", () => {
    expect(reasonOf(runWith("not-json"))).toContain("not JSON");
  });

  it("fails on a category the tool never reported, rather than reading it as empty", () => {
    expect(reasonOf(runWith("ok", ["unused_exports", "no_such_category"]))).toContain("no_such_category");
  });

  it("fails on a category whose rule the tool has switched off, which would report nothing forever", () => {
    const reason = reasonOf(runWith("rule-off", ["unused_exports"]));

    expect(reason).toContain("unused-exports");
    expect(reason).toContain("can never report");
  });

  it("lets a category through when its rule is live", () => {
    expect(runWith("ok", ["unused_exports"]).kind).toBe("findings");
  });

  it("fails when the tool will not say which of its rules are on", () => {
    expect(reasonOf(runWith("no-rules", ["unused_exports"]))).toContain("severities were unreadable");
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

describe("the categories it asks for when the project names none", () => {
  it("leaves out one whose rule fallow ships off, which would fail every run out of the box", () => {
    expect(DEFAULT_FALLOW_CATEGORIES).not.toContain("private_type_leaks");
  });

  it("still offers it, for a project that turned that rule on in fallow", () => {
    expect(FALLOW_CATEGORIES).toContain("private_type_leaks");
  });

  it("asks for every other category it knows how to read, so none is dropped unnoticed", () => {
    expect(DEFAULT_FALLOW_CATEGORIES).toEqual(
      FALLOW_CATEGORIES.filter((category) => category !== "private_type_leaks"),
    );
  });
});
