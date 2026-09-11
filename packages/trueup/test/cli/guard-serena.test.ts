import { describe, expect, it } from "vitest";
import { GUARDED_FOR_SERENA, guardFor } from "../support/guard.ts";
import { fixtureAt } from "../support/fixtures.ts";

const guard = guardFor(GUARDED_FOR_SERENA);
const RUNNER = "src/engine/runner.ts";
const IMPORTS_DOMAIN = 'import { thing } from "../domain/thing.js";';

const replacing = (input: Record<string, unknown>) => ({
  tool_name: "mcp__serena__replace_content",
  tool_input: { relative_path: RUNNER, mode: "literal", ...input },
});

describe("guarding a replacement proposed through Serena", () => {
  it("resolves the relative path against the project root and blocks", async () => {
    const { output } = await guard(replacing({ needle: "export const run", repl: "export const start" }));
    const reason: string = JSON.parse(output).hookSpecificOutput.permissionDecisionReason;

    expect(reason).toContain(`every-import-respects-its-zone-boundary  ${RUNNER}`);
    expect(reason).toContain("may not reach domain");
  });

  it("nests the whole remedy under the claim, so its bullets do not read as a new block", async () => {
    const { output } = await guard(replacing({ needle: "export const run", repl: "export const start" }));
    const reason: string = JSON.parse(output).hookSpecificOutput.permissionDecisionReason;
    const body = reason.split(`every-import-respects-its-zone-boundary  ${RUNNER}\n`)[1] ?? "";

    expect(body).toContain("\n  Do this:");
    expect(body).toContain("\n  - Move the code to a zone that may reach the target.");
  });

  it("allows a replacement that removes the violation", async () => {
    const { output } = await guard(replacing({ needle: IMPORTS_DOMAIN, repl: "const thing = 1;" }));
    expect(output).toBe("");
  });

  it("offers no opinion on a regex replacement, whose dialect it cannot reproduce", async () => {
    const { output } = await guard(replacing({ mode: "regex", needle: "export const run.*", repl: "x" }));
    expect(output).toBe("");
  });
});

const afterTool = (tool: string, input: Record<string, unknown>) => ({
  hook_event_name: "PostToolUse",
  tool_name: `mcp__serena__${tool}`,
  tool_input: input,
});

describe("reviewing an edit Serena has already written", () => {
  it("reports the file it was told about, without claiming it can deny", async () => {
    const { output } = await guard(afterTool("replace_symbol_body", { relative_path: RUNNER, body: "" }));
    const { hookSpecificOutput: result } = JSON.parse(output);

    expect(result.hookEventName).toBe("PostToolUse");
    expect(result.permissionDecision).toBeUndefined();
    expect(result.additionalContext).toContain(`every-import-respects-its-zone-boundary  ${RUNNER}`);
  });

  it("names each offending file when the tool touched files it did not name", async () => {
    const { output } = await guard(
      afterTool("replace_in_files", { needle: "a", repl: "b", mode: "literal" }),
    );
    const context: string = JSON.parse(output).hookSpecificOutput.additionalContext;

    expect(context).toContain("every-import-respects-its-zone-boundary\n");
    expect(context).toContain(`  ${RUNNER}  `);
  });

  it("stays quiet about a file that breaks nothing", async () => {
    const { output } = await guard(
      afterTool("replace_symbol_body", { relative_path: "src/domain/thing.ts" }),
    );
    expect(output).toBe("");
  });

  const contextAfter = async (tool: string, input: Record<string, unknown>): Promise<string> => {
    const { output } = await guard(afterTool(tool, input));
    return output === "" ? "" : JSON.parse(output).hookSpecificOutput.additionalContext;
  };

  it("looks past a directory a bulk replace was scoped to, which names no file to check", async () => {
    expect(await contextAfter("replace_in_files", { relative_path: "src/domain" })).toContain(RUNNER);
  });

  it("looks past the file a rename named, since the files it rewrote are the others", async () => {
    const said = await contextAfter("rename_symbol", {
      relative_path: "src/domain/thing.ts",
      name_path: "thing",
      new_name: "widget",
    });

    expect(said).toContain(RUNNER);
  });

  const BUDGETED = fixtureAt("guarded-budget");

  const afterEditIn = async (cwd: string, path: string): Promise<string> => {
    const { output } = await guardFor(cwd)(afterTool("replace_symbol_body", { relative_path: path }));
    return output === "" ? "" : JSON.parse(output).hookSpecificOutput.additionalContext;
  };

  it("carries the review budget, which is about the change and not the file just edited", async () => {
    expect(await afterEditIn(BUDGETED, "src/domain/thing.ts")).toContain("no-change-outgrows-its-review");
  });

  it("says nothing is broken when only the budget has something to say", async () => {
    const said = await afterEditIn(BUDGETED, "src/domain/thing.ts");

    expect(said.split("\n")[0]).toBe("Nothing is broken, but this is worth knowing before you go on.");
  });

  it("carries the budget beside a real refusal rather than instead of it", async () => {
    const said = await afterEditIn(BUDGETED, "src/engine/runner.ts");

    expect(said).toContain("no-change-outgrows-its-review");
    expect(said.split("\n")[0]).toContain("That edit broke");
  });

  it("carries only the refusal when the rules were the thing edited, with no note riding along", async () => {
    const said = await afterEditIn(BUDGETED, "trueup.config.ts");

    const claims = said.split("\n").filter((line) => line.includes("no-"));

    expect(claims).toEqual(["no-edit-changes-the-rules-themselves  trueup.config.ts"]);
  });

  it("stays silent where no budget is set and nothing is broken", async () => {
    expect(await afterEditIn(GUARDED_FOR_SERENA, "src/domain/thing.ts")).toBe("");
  });

  it("says the findings may pre-date a change that named no single file", async () => {
    const said = await contextAfter("replace_in_files", { needle: "a", repl: "b", mode: "literal" });

    expect(said.split("\n")[0]).toContain("may pre-date the change");
    expect(said).not.toContain("That edit broke");
  });
});
