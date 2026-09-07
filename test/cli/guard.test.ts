import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { baselinePathIn, writeBaseline } from "../../src/adapters/baseline-file.ts";
import { runGuard } from "../../src/cli/guard.ts";
import { check } from "../../src/compose.ts";
import { baselineOf } from "../../src/ratchet/apply.ts";

const PROJECT = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "guarded");
const BASELINE = baselinePathIn(PROJECT);
const NEW_FILE = join(PROJECT, "src/engine/added.ts");

const guard = async (payload: unknown): Promise<{ code: number; output: string }> => {
  let output = "";
  const code = await runGuard({
    cwd: PROJECT,
    stdin: typeof payload === "string" ? payload : JSON.stringify(payload),
    write: (line) => (output += line),
  });
  return { code, output };
};

const writing = (path: string, content: string) => ({
  tool_name: "Write",
  tool_input: { file_path: path, content },
});

const REACHES_DOMAIN = 'import { thing } from "../domain/thing.js";\n\nexport const added = thing;\n';
const REACHES_NOTHING = "export const added = 1;\n";

describe("guarding a proposed write", () => {
  afterEach(() => {
    if (existsSync(BASELINE)) rmSync(BASELINE);
  });

  it("blocks a file that has not been written yet", async () => {
    const { output } = await guard(writing(NEW_FILE, REACHES_DOMAIN));
    const decision = JSON.parse(output);

    expect(decision.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput.permissionDecisionReason).toContain("may not reach domain");
    expect(existsSync(NEW_FILE)).toBe(false);
  });

  it("names the file once beside the claim, so a message that reads as a fragment has a subject", async () => {
    const { output } = await guard(writing(NEW_FILE, REACHES_DOMAIN));
    const reason: string = JSON.parse(output).hookSpecificOutput.permissionDecisionReason;

    expect(reason).toContain("every-import-respects-its-zone-boundary  src/engine/added.ts");
    expect(reason.split("src/engine/added.ts").length - 1).toBe(1);
    expect(reason).not.toContain(PROJECT);
  });

  it("allows a proposal that breaks nothing, despite an existing violation elsewhere", async () => {
    expect((await guard(writing(NEW_FILE, REACHES_NOTHING))).output).toBe("");
  });

  it("allows a proposal whose violation is already in the baseline", async () => {
    const report = check({
      root: PROJECT,
      roots: [join(PROJECT, "src")],
      zones: [
        { name: "engine", patterns: ["src/engine/**"] },
        { name: "domain", patterns: ["src/domain/**"] },
      ],
      boundaries: [{ from: "engine", mayNotReach: ["domain"] }],
      overlay: new Map([[NEW_FILE, REACHES_DOMAIN]]),
    });
    writeBaseline(BASELINE, baselineOf(report, PROJECT));

    expect((await guard(writing(NEW_FILE, REACHES_DOMAIN))).output).toBe("");
  });

  it("ignores a file the project does not analyse", async () => {
    expect((await guard(writing(join(PROJECT, "notes.md"), "# hello"))).output).toBe("");
  });

  it("ignores a path outside the analysed roots", async () => {
    expect((await guard(writing(join(PROJECT, "scripts/tool.ts"), REACHES_DOMAIN))).output).toBe("");
  });

  it("ignores a tool that writes nothing", async () => {
    expect((await guard({ tool_name: "Bash", tool_input: { command: "ls" } })).output).toBe("");
  });

  it("stays out of the way when the payload is not usable", async () => {
    expect((await guard("not json at all")).output).toBe("");
    expect((await guard({ tool_name: "Write", tool_input: {} })).output).toBe("");
  });

  it("never fails the hook itself, so a broken guard cannot block every edit", async () => {
    expect((await guard(writing(NEW_FILE, REACHES_DOMAIN))).code).toBe(0);
    expect((await guard("not json at all")).code).toBe(0);
  });
});

describe("guarding a proposed edit", () => {
  it("applies the replacement to the file on disk before judging it", async () => {
    const { output } = await guard({
      tool_name: "Edit",
      tool_input: {
        file_path: join(PROJECT, "src/engine/runner.ts"),
        old_string: 'import { thing } from "../domain/thing.js";',
        new_string: "const thing = 1;",
      },
    });

    expect(output).toBe("");
  });

  it("ignores an edit whose anchor is not in the file", async () => {
    const { output } = await guard({
      tool_name: "Edit",
      tool_input: {
        file_path: join(PROJECT, "src/engine/runner.ts"),
        old_string: "text that is absent",
        new_string: "whatever",
      },
    });

    expect(output).toBe("");
  });
});
