import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { guardFor } from "../support/guard.ts";

const PROJECT = fixtureAt("guarded-content");
const guard = guardFor(PROJECT);

const WORN = 'export const className = "stray-class";\n';
const PLAIN = 'export const className = "plain";\n';

const verdictOn = async (file: string, content: string): Promise<string> => {
  const { output } = await guard({
    tool_name: "Write",
    tool_input: { file_path: join(PROJECT, file), content },
  });
  return output === "" ? "allowed" : JSON.parse(output).hookSpecificOutput.permissionDecision;
};

describe("a rule that reads the text of a file", () => {
  it("refuses a write that introduces what the rule forbids", async () => {
    expect(await verdictOn("src/clean.ts", WORN)).toBe("deny");
  });

  it("allows the write that takes it back out, rather than judging the saved file", async () => {
    expect(await verdictOn("src/worn.ts", PLAIN)).toBe("allowed");
  });

  it("still refuses a write that leaves it in place", async () => {
    expect(await verdictOn("src/worn.ts", WORN)).toBe("deny");
  });
});
