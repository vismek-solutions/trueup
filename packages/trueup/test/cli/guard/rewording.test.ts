import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../../support/fixtures.ts";
import { guardFor } from "../../support/guard.ts";

const PROJECT = fixtureAt("guarded-rewording");
const THING = join(PROJECT, "src/lib/thing.ts");
const CLOSED = "export const helper = (value: string): string => value.trim();\n";
const WITH_A_GAP = `import { nope } from "./nowhere.js";\n\n${CLOSED}\nexport const gap = nope;\n`;

const proposing = (content: string) =>
  guardFor(PROJECT)({ tool_name: "Write", tool_input: { file_path: THING, content } });

const refusalFor = async (content: string): Promise<string> => {
  const { output } = await proposing(content);
  return JSON.parse(output).hookSpecificOutput.permissionDecisionReason;
};

describe("an edit that re-words a finding the baseline already holds", () => {
  it("lands, since the finding it leaves is the accepted one under different words", async () => {
    const { output } = await proposing(CLOSED);

    expect(output).toBe("");
  });

  it("is refused for a claim that retired nothing, so this is not a way in", async () => {
    const refusal = await refusalFor(WITH_A_GAP);

    expect(refusal).toContain("every-import-resolves");
    expect(refusal).not.toContain("no-value-is-declared-away-from-its-only-consumer");
  });
});
