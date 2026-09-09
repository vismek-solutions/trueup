import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyOfFixture, discard, fixtureAt } from "../support/fixtures.ts";
import { guardFor } from "../support/guard.ts";
import { baselinePathIn, writeBaseline } from "../../src/adapters/baseline-file.ts";
import { check } from "../../src/compose.ts";
import { baselineOf } from "../../src/ratchet/apply.ts";

let PROJECT = "";
let BASELINE = "";
let NEW_FILE = "";

const guard = (payload: unknown) => guardFor(PROJECT)(payload);

const writing = (path: string, content: string) => ({
  tool_name: "Write",
  tool_input: { file_path: path, content },
});

const REACHES_DOMAIN = 'import { thing } from "../domain/thing.js";\n\nexport const added = thing;\n';
const REACHES_NOTHING = "export const added = 1;\n";

beforeEach(() => {
  PROJECT = copyOfFixture("guarded");
  BASELINE = baselinePathIn(PROJECT);
  NEW_FILE = join(PROJECT, "src/engine/added.ts");
});

afterEach(() => {
  discard(PROJECT);
});

describe("guarding a proposed write", () => {
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

  it("says nothing about reach when the refused path falls in no zone", async () => {
    const { output } = await guard(writing(join(PROJECT, "src/loose.ts"), "export const loose = 1;\n"));
    const reason = JSON.parse(output).hookSpecificOutput.permissionDecisionReason;

    expect(reason).toContain("matches no zone");
    expect(reason).not.toContain("may reach");
  });

  it("names the command the project is run by inside the guidance it hands back", async () => {
    const { output } = await guard(writing(join(PROJECT, "src/loose.ts"), "export const loose = 1;\n"));
    const reason = JSON.parse(output).hookSpecificOutput.permissionDecisionReason;

    expect(reason).toContain("`trueup explain <file>`");
  });

  it("separates the zones a refused file may reach rather than running them together", async () => {
    const gap = 'import { nope } from "./nowhere.js";\n\nexport const gap = nope;\n';
    const { output } = await guard(writing(join(PROJECT, "src/domain/gap.ts"), gap));
    const reason = JSON.parse(output).hookSpecificOutput.permissionDecisionReason;

    expect(reason).toContain("domain may reach engine · domain");
  });

  it("says what the file may reach, so the next attempt is not a guess", async () => {
    const { output } = await guard(writing(NEW_FILE, REACHES_DOMAIN));
    const reason: string = JSON.parse(output).hookSpecificOutput.permissionDecisionReason;

    expect(reason).toContain("engine may reach engine");
    expect(reason).not.toContain("engine may reach engine · domain");
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
      boundaries: [{ from: "engine", allow: [] }],
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

  it("ignores a path inside a directory the analysis skips", async () => {
    const inside = join(PROJECT, "src/build/added.ts");
    expect((await guard(writing(inside, REACHES_DOMAIN))).output).toBe("");
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
    expect(await refusalFor(join(PROJECT, "trueup.config.ts"))).toContain(`${CLAIM}  trueup.config.ts`);
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

  it("asks rather than refuses, so setup is still possible", async () => {
    const { output } = await guard(writing(join(PROJECT, "trueup.config.ts"), "whatever"));
    const { hookSpecificOutput: result } = JSON.parse(output);

    expect(result.permissionDecision).toBe("ask");
    expect(result.permissionDecisionReason).toContain("Approve it if this is setup");
  });

  it("leaves every other file to the ordinary rules", async () => {
    expect(await refusalFor(join(PROJECT, "src/engine/spare.ts"))).toBe("");
  });

  it("reports rather than denies once the write has already happened", async () => {
    const { output } = await guard({
      hook_event_name: "PostToolUse",
      tool_name: "mcp__serena__replace_symbol_body",
      tool_input: { relative_path: "trueup.config.ts" },
    });
    const { hookSpecificOutput: result } = JSON.parse(output);

    expect(result.hookEventName).toBe("PostToolUse");
    expect(result.permissionDecision).toBeUndefined();
    expect(result.additionalContext).toContain(CLAIM);
  });

  it("blames the edit itself, since a protected file is the one the tool named", async () => {
    const { output } = await guard({
      hook_event_name: "PostToolUse",
      tool_name: "mcp__serena__rename_symbol",
      tool_input: { relative_path: "trueup.config.ts", name_path: "zones", new_name: "areas" },
    });
    const said: string = JSON.parse(output).hookSpecificOutput.additionalContext;

    expect(said.split("\n")[0]).toBe(
      "That edit broke one of the project's architecture rules. Repair it before moving on.",
    );
    expect(said).toContain(CLAIM);
  });
});

describe("a hook it has no rulebook to answer with", () => {
  it("stays out of the way when nothing above the file declares any rules", async () => {
    const empty = mkdtempSync(join(tmpdir(), "trueup-guard-"));

    try {
      const { code, output } = await guardFor(empty)(
        writing(join(empty, "src/x.ts"), "export const x = 1;\n"),
      );

      expect(code).toBe(0);
      expect(output).toBe("");
    } finally {
      rmSync(empty, { recursive: true });
    }
  });

  it("says the rulebook would not load rather than judging the edit against nothing", async () => {
    const broken = fixtureAt("broken-rulebook");
    const { code, output } = await guardFor(broken)(
      writing(join(broken, "src/x.ts"), "export const x = 1;\n"),
    );

    expect(code).toBe(0);
    expect(output).toContain("could not be read");
  });
});

describe("a project whose sources sit under more than one root", () => {
  const TWO_ROOTS = fixtureAt("guarded-two-roots");
  const proposing = guardFor(TWO_ROOTS);

  const refusalIn = async (path: string, content: string): Promise<string> => {
    const { output } = await proposing(writing(join(TWO_ROOTS, path), content));
    return output === "" ? "" : JSON.parse(output).hookSpecificOutput.permissionDecisionReason;
  };

  it("judges a write under the first root", async () => {
    const said = await refusalIn("src/engine/added.ts", 'import { thing } from "../domain/thing.js";\n');

    expect(said).toContain("may not reach domain");
  });

  it("judges a write under the second root, not only the one listed first", async () => {
    const said = await refusalIn("tools/added.ts", 'import { thing } from "../src/domain/thing.js";\n');

    expect(said).toContain("may not reach domain");
  });
});

describe("guarding a file that was already broken", () => {
  const mending = () => join(PROJECT, "src/engine/mending.ts");

  const startingFrom = (text: string) => {
    writeFileSync(join(PROJECT, "src/engine/helper.ts"), "export const helper = 1;\n", "utf8");
    writeFileSync(mending(), text, "utf8");
  };

  const refusalOf = async (text: string): Promise<string> => {
    const { output } = await guard(writing(mending(), text));
    return JSON.parse(output).hookSpecificOutput.permissionDecisionReason;
  };

  it("says an import was unresolved before the edit, so half a repair does not read as the cause", async () => {
    startingFrom(
      'import { a } from "./gone.js";\nimport { b } from "./missing.js";\n\nexport const both = [a, b];\n',
    );

    const reason = await refusalOf(
      'import { a } from "./gone.js";\nimport { helper } from "./helper.js";\n\nexport const both = [a, helper];\n',
    );

    expect(reason).toContain("./gone.js, which does not resolve");
    expect(reason).toContain("already unresolved before this edit");
  });

  it("says nothing of the sort about one the edit itself brought in", async () => {
    startingFrom('import { helper } from "./helper.js";\n\nexport const both = helper;\n');

    const reason = await refusalOf(
      'import { helper } from "./helper.js";\nimport { typo } from "./typo.js";\n\nexport const both = [helper, typo];\n',
    );

    expect(reason).toContain("./typo.js, which does not resolve");
    expect(reason).not.toContain("already unresolved before this edit");
  });
});

describe("a project that lets its rulebook be edited", () => {
  const RULEBOOK = fixtureAt("guarded-rulebook");
  const editing = guardFor(RULEBOOK);

  it("does not analyse the rulebook it was told to ignore, so the edit stands", async () => {
    const path = join(RULEBOOK, "trueup.config.ts");
    const { output } = await editing(writing(path, "export default { zones: [] };\n"));

    expect(output).toBe("");
  });
});
