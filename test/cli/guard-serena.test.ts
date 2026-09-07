import { describe, expect, it } from "vitest";
import { GUARDED_FOR_SERENA, guardFor } from "../support/guard.ts";

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
});
