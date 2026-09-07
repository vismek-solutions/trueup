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

const CLAIM = "no-edit-changes-the-rules-themselves";

const refusalFor = async (path: string): Promise<string> => {
  const { output } = await guard(writing(path, "whatever"));
  return output === "" ? "" : JSON.parse(output).hookSpecificOutput.permissionDecisionReason;
};

describe("refusing to let the rules be edited", () => {
  it("blocks the config the rules are read from", async () => {
    expect(await refusalFor(join(PROJECT, "architecture.config.ts"))).toContain(
      `${CLAIM}  architecture.config.ts`,
    );
  });

  it("blocks the baseline, so a violation cannot be recorded away", async () => {
    expect(await refusalFor(BASELINE)).toContain(CLAIM);
  });

  it("blocks whatever else the project listed as protected", async () => {
    expect(await refusalFor(join(PROJECT, "locked/thing.ts"))).toContain(`${CLAIM}  locked/thing.ts`);
  });

  it("protects files the analysis would never have looked at", async () => {
    expect(await refusalFor(join(PROJECT, "locked/notes.md"))).toContain(CLAIM);
  });

  it("says that switching the check off is not the fix", async () => {
    expect(await refusalFor(join(PROJECT, "architecture.config.ts"))).toContain("fix the code");
  });

  it("leaves every other file to the ordinary rules", async () => {
    expect(await refusalFor(join(PROJECT, "src/engine/spare.ts"))).toBe("");
  });

  it("reports rather than denies once the write has already happened", async () => {
    const { output } = await guard({
      hook_event_name: "PostToolUse",
      tool_name: "mcp__serena__replace_symbol_body",
      tool_input: { relative_path: "architecture.config.ts" },
    });
    const { hookSpecificOutput: result } = JSON.parse(output);

    expect(result.hookEventName).toBe("PostToolUse");
    expect(result.permissionDecision).toBeUndefined();
    expect(result.additionalContext).toContain(CLAIM);
  });
});

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
