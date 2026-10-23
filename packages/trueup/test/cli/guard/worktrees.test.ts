import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { guardFor, verdictFrom } from "../../support/guard.ts";

const rulebook = (allow: readonly string[]) => `export default {
  include: ["src"],
  zones: [
    { name: "engine", patterns: ["src/engine/**"] },
    { name: "domain", patterns: ["src/domain/**"] },
  ],
  boundaries: [{ from: "engine", allow: ${JSON.stringify(allow)} }],
};
`;

const RUNNER = "src/engine/runner.ts";
const CLEAN = 'export const run = (): string => "run";\n';
const REACHES_DOMAIN =
  'import { thing } from "../domain/thing.js";\n\nexport const run = (): string => thing;\n';

let BASE = "";
let MAIN = "";
let STRICT = "";
let LOOSE = "";

beforeAll(() => {
  // a hook's working directory is always physical, and tmpdir on macOS is a link
  BASE = realpathSync(mkdtempSync(join(tmpdir(), "trueup-worktrees-")));
  MAIN = join(BASE, "main");
  STRICT = join(BASE, "strict");
  LOOSE = join(BASE, "loose");
  const git = (cwd: string, ...args: string[]) => spawnSync("git", ["-C", cwd, ...args]);
  const wrote = (root: string, file: string, text: string) => writeFileSync(join(root, file), text, "utf8");

  mkdirSync(join(MAIN, "src", "engine"), { recursive: true });
  mkdirSync(join(MAIN, "src", "domain"));
  wrote(MAIN, "trueup.config.ts", rulebook([]));
  wrote(MAIN, RUNNER, CLEAN);
  wrote(MAIN, "src/domain/thing.ts", 'export const thing = "thing";\n');
  git(MAIN, "init", "-b", "main");
  git(MAIN, "config", "user.email", "a@b.c");
  git(MAIN, "config", "user.name", "t");
  git(MAIN, "add", "-A");
  git(MAIN, "commit", "-m", "first");
  git(MAIN, "worktree", "add", STRICT, "-b", "strict");
  git(MAIN, "worktree", "add", LOOSE, "-b", "loose");
  wrote(LOOSE, "trueup.config.ts", rulebook(["domain"]));
  symlinkSync(STRICT, join(BASE, "slot"));
});

const verdictOn = async (cwd: string, payload: unknown): Promise<string> => {
  const { output } = await guardFor(cwd)(payload);
  return output === "" ? "allowed" : JSON.parse(output).hookSpecificOutput.permissionDecision;
};

describe("guarding an edit in a sibling worktree", () => {
  it("refuses a write the worktree's own rulebook forbids, from a hook started in the main checkout", async () => {
    expect(await verdictFrom(MAIN)(join("..", "strict", RUNNER), REACHES_DOMAIN)).toBe("deny");
  });

  it("reaches the worktree through a link to it, as a slot directory gives one", async () => {
    expect(await verdictFrom(MAIN)(join("..", "slot", RUNNER), REACHES_DOMAIN)).toBe("deny");
  });

  it("lets through what the worktree's own rulebook allows, though the main checkout forbids it", async () => {
    expect(await verdictFrom(MAIN)(join("..", "loose", RUNNER), REACHES_DOMAIN)).toBe("allowed");
    expect(await verdictFrom(MAIN)(RUNNER, REACHES_DOMAIN)).toBe("deny");
  });

  it("refuses a Serena replacement from a server bound to the worktree its hook was started in", async () => {
    const payload = {
      tool_name: "mcp__serena-wt__replace_content",
      tool_input: { relative_path: RUNNER, mode: "literal", needle: CLEAN, repl: REACHES_DOMAIN },
    };

    expect(await verdictOn(STRICT, payload)).toBe("deny");
  });
});
