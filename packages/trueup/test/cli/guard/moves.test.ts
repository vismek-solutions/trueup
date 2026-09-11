import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyOfFixture, discard } from "../../support/fixtures.ts";
import { guardFor } from "../../support/guard.ts";

const COPIED =
  'export const label = (parts: readonly string[]): string =>\n  parts.map((part) => part.trim()).join("-");\n';

let PROJECT = "";

beforeEach(() => {
  PROJECT = copyOfFixture("guarded-move");
});

afterEach(() => {
  discard(PROJECT);
});

const proposing = (path: string, content: string) =>
  guardFor(PROJECT)({ tool_name: "Write", tool_input: { file_path: join(PROJECT, path), content } });

const refusalFor = async (path: string, content: string): Promise<string> => {
  const { output } = await proposing(path, content);
  return JSON.parse(output).hookSpecificOutput.permissionDecisionReason;
};

describe("a declaration on its way from one file to another", () => {
  it("lets the new file through, since a move looks like a copy until the old one is gone", async () => {
    const { output } = await proposing("src/shared.ts", COPIED);

    expect(output).toBe("");
  });

  it("still refuses a second copy landing in a file that already exists", async () => {
    expect(await refusalFor("src/two.ts", COPIED)).toContain("no-declaration-is-written-twice");
  });

  it("holds every other rule over the new file, so this is one claim and not a way in", async () => {
    const gap = 'import { nope } from "./nowhere.js";\n\nexport const gap = nope;\n';

    expect(await refusalFor("src/shared.ts", gap)).toContain("every-import-resolves");
  });
});
