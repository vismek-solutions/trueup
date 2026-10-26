import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { guardFor } from "../../support/guard.ts";
import { fixtureAt } from "../../support/fixtures.ts";

const PROJECT = fixtureAt("guarded");
const guard = guardFor(PROJECT);

describe("reviewing a write Cursor has already made", () => {
  it("hands the findings back at the top level, the only place Cursor reads them", async () => {
    const file_path = join(PROJECT, "src/engine/runner.ts");
    const { output } = await guard({
      hook_event_name: "postToolUse",
      cursor_version: "3.27.14",
      tool_name: "Write",
      tool_use_id: "t1",
      tool_input: { file_path, content: readFileSync(file_path, "utf8") },
      tool_output: JSON.stringify({ file_path, success: true }),
      duration: 12,
    });
    const answer = JSON.parse(output);

    expect(answer.additional_context).toContain("may not reach domain");
    expect(answer.hookSpecificOutput.permissionDecision).toBeUndefined();
  });
});

describe("guarding the rulebook against a Cursor agent", () => {
  it("refuses outright, since Cursor lets an ask through without asking anyone", async () => {
    const { output } = await guard({
      hook_event_name: "preToolUse",
      cursor_version: "3.27.14",
      tool_name: "Write",
      tool_use_id: "t1",
      tool_input: { file_path: join(PROJECT, "trueup.config.ts"), content: "export default {};\n" },
    });
    const { hookSpecificOutput: result } = JSON.parse(output);

    expect(result.permissionDecision).toBe("deny");
    expect(result.permissionDecisionReason).toContain("leave the check failing");
  });
});
