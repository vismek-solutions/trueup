import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli } from "../../../src/cli/main.ts";
import { copyOfFixture, discard } from "../../support/fixtures.ts";
import { guardFor } from "../../support/guard.ts";

const COPIED =
  'export const label = (parts: readonly string[]): string =>\n  parts.map((part) => part.trim()).join("-");\n';

const GAP = 'import { nope } from "./nowhere.js";\n\nexport const gap = nope;\n';

let PROJECT = "";

beforeEach(() => {
  PROJECT = copyOfFixture("guarded-move");
});

afterEach(() => {
  discard(PROJECT);
});

const proposing = (path: string, content: string) =>
  guardFor(PROJECT)({ tool_name: "Write", tool_input: { file_path: join(PROJECT, path), content } });

const deferring = (claims: readonly string[]): void => {
  const config = join(PROJECT, "trueup.config.ts");
  const deferral = `  deferAtWrite: ${JSON.stringify(claims)},\n});`;
  writeFileSync(config, readFileSync(config, "utf8").replace("});", deferral));
};

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
    expect(await refusalFor("src/shared.ts", GAP)).toContain("every-import-resolves");
  });
});

describe("a claim the rulebook defers to the full check", () => {
  it("lets a new file and an edit through on that claim, and still refuses on one it does not list", async () => {
    deferring(["every-import-resolves"]);

    expect((await proposing("src/shared.ts", GAP)).output).toBe("");
    expect((await proposing("src/two.ts", GAP)).output).toBe("");
    expect(await refusalFor("src/two.ts", COPIED)).toContain("no-declaration-is-written-twice");
  });

  it("names a deferred claim the run never makes, since the guard then refuses it as if unlisted", async () => {
    deferring(["every-import-resolves", "no-such-claim"]);

    let output = "";
    await runCli({ cwd: PROJECT, argv: [], write: (line) => (output += `${line}\n`) });

    expect(output).toContain("deferAtWrite names no-such-claim");
    expect(output).not.toContain("deferAtWrite names every-import-resolves");
  });
});
