import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contextFor, modeOf, requestFrom, verdictFor } from "../../src/adapters/claude-code-hook.ts";
import type { Decision } from "../../src/ports/proposal.ts";

const ROOT = mkdtempSync(join(tmpdir(), "trueup-hook-"));
const NAME = "held.ts";
const PATH = join(ROOT, NAME);

const SPELLS_NULL = "spells-null.ts";

writeFileSync(PATH, "one two one\n", "utf8");
writeFileSync(join(ROOT, SPELLS_NULL), "const x = null;\n", "utf8");

const asked = (tool: string, input: Record<string, unknown>): unknown => ({
  tool_name: tool,
  tool_input: input,
});

const proposalOf = (tool: string, input: Record<string, unknown>) => {
  const request = requestFrom(asked(tool, input), ROOT);
  return request?.kind === "propose" ? request.proposal : null;
};

describe("reading a proposed write", () => {
  it("takes the content as the whole file", () => {
    expect(proposalOf("Write", { file_path: PATH, content: "fresh" })).toEqual({
      path: PATH,
      text: "fresh",
    });
  });

  it("offers no opinion when there is no content to judge", () => {
    expect(proposalOf("Write", { file_path: PATH })).toBeNull();
  });

  it("offers no opinion on a tool it does not know", () => {
    expect(proposalOf("Bash", { file_path: PATH, content: "fresh" })).toBeNull();
  });

  it("offers no opinion on a tool it does not know that happens to replace literally", () => {
    const input = { relative_path: NAME, mode: "literal", needle: "one", repl: "two" };

    expect(proposalOf("Bash", input)).toBeNull();
  });

  it("offers no opinion when the payload names no path at all", () => {
    expect(proposalOf("Write", { content: "fresh" })).toBeNull();
  });

  it("offers no opinion for an empty relative path, which would name the root directory", () => {
    expect(proposalOf("Write", { relative_path: "", content: "fresh" })).toBeNull();
  });
});

describe("reading a proposed edit", () => {
  it("applies the replacement once, as the tool would", () => {
    expect(proposalOf("Edit", { file_path: PATH, old_string: "one", new_string: "two" })).toEqual({
      path: PATH,
      text: "two two one\n",
    });
  });

  it("applies it everywhere when the tool was told to", () => {
    const input = { file_path: PATH, old_string: "one", new_string: "two", replace_all: true };

    expect(proposalOf("Edit", input)).toEqual({ path: PATH, text: "two two two\n" });
  });

  it("treats anything but true as once, since the flag is the tool's own", () => {
    const input = { file_path: PATH, old_string: "one", new_string: "two", replace_all: "yes" };

    expect(proposalOf("Edit", input)).toEqual({ path: PATH, text: "two two one\n" });
  });

  it("offers no opinion when the text to replace is missing", () => {
    expect(proposalOf("Edit", { file_path: PATH, new_string: "two" })).toBeNull();
  });

  it("offers no opinion when the replacement is missing", () => {
    expect(proposalOf("Edit", { file_path: PATH, old_string: "one" })).toBeNull();
  });

  it("offers no opinion on a missing old_string even where the file spells out null", () => {
    const input = { file_path: join(ROOT, SPELLS_NULL), new_string: "two" };

    expect(proposalOf("Edit", input)).toBeNull();
  });

  it("offers no opinion when the text to replace is not in the file", () => {
    expect(proposalOf("Edit", { file_path: PATH, old_string: "absent", new_string: "two" })).toBeNull();
  });

  it("offers no opinion when the file cannot be read", () => {
    const input = { file_path: join(ROOT, "gone.ts"), old_string: "one", new_string: "two" };

    expect(proposalOf("Edit", input)).toBeNull();
  });
});

describe("reading a replacement proposed through Serena", () => {
  const serena = "mcp__serena__replace_content";

  it("resolves a relative path against the project root", () => {
    const input = { relative_path: NAME, mode: "literal", needle: "one", repl: "two" };

    expect(proposalOf(serena, input)).toEqual({ path: PATH, text: "two two one\n" });
  });

  it("keeps an absolute relative_path as it stands", () => {
    const input = { relative_path: PATH, mode: "literal", needle: "one", repl: "two" };

    expect(proposalOf(serena, input)).toEqual({ path: PATH, text: "two two one\n" });
  });

  it("prefers file_path where a payload carries both", () => {
    const input = {
      file_path: PATH,
      relative_path: "elsewhere.ts",
      mode: "literal",
      needle: "one",
      repl: "x",
    };

    expect(proposalOf(serena, input)?.path).toBe(PATH);
  });

  it("replaces every occurrence when told it may", () => {
    const input = {
      relative_path: NAME,
      mode: "literal",
      needle: "one",
      repl: "two",
      allow_multiple_occurrences: true,
    };

    expect(proposalOf(serena, input)?.text).toBe("two two two\n");
  });

  it("offers no opinion on a regex replacement, whose dialect it cannot reproduce", () => {
    const input = { relative_path: NAME, mode: "regex", needle: "one", repl: "two" };

    expect(proposalOf(serena, input)).toBeNull();
  });

  it("offers no opinion when no path is named at all", () => {
    expect(proposalOf(serena, { mode: "literal", needle: "one", repl: "two" })).toBeNull();
  });

  it("offers no opinion for an empty relative path, which would name the root itself", () => {
    const input = { relative_path: "", mode: "literal", needle: "one", repl: "two" };

    expect(proposalOf(serena, input)).toBeNull();
  });
});

describe("reading a payload that is not a proposal", () => {
  const reviewing = (tool: unknown, input: Record<string, unknown>) =>
    requestFrom({ hook_event_name: "PostToolUse", tool_name: tool, tool_input: input }, ROOT);

  it("reviews rather than proposes after the tool has already run", () => {
    expect(reviewing("Write", { file_path: PATH })).toEqual({
      kind: "review",
      path: PATH,
      spread: false,
    });
  });

  it("reviews with no path when the tool named none", () => {
    expect(reviewing("Write", {})).toEqual({ kind: "review", path: null, spread: true });
  });

  it("looks past the file a rename named, since a rename rewrites every reference to it", () => {
    expect(reviewing("mcp__serena__rename_symbol", { file_path: PATH })).toEqual({
      kind: "review",
      path: PATH,
      spread: true,
    });
  });

  it("looks past the file a symbol deletion named, for the same reason", () => {
    expect(reviewing("mcp__serena__safe_delete_symbol", { file_path: PATH })).toEqual({
      kind: "review",
      path: PATH,
      spread: true,
    });
  });

  it("looks past the path a bulk replace named, which may be a whole directory", () => {
    expect(reviewing("mcp__serena__replace_in_files", { relative_path: "src" })).toEqual({
      kind: "review",
      path: join(ROOT, "src"),
      spread: true,
    });
  });

  it("keeps a tool that edits only the file it named to that file", () => {
    expect(reviewing("mcp__serena__replace_symbol_body", { file_path: PATH })).toEqual({
      kind: "review",
      path: PATH,
      spread: false,
    });
  });

  it("says nothing about a payload that is not an object", () => {
    expect(requestFrom("Write", ROOT)).toBeNull();
    expect(requestFrom(null, ROOT)).toBeNull();
  });

  it("says nothing when the payload names no tool input", () => {
    expect(requestFrom({ tool_name: "Write" }, ROOT)).toBeNull();
  });

  it("says nothing when the tool name is not a string", () => {
    expect(requestFrom({ tool_name: 7, tool_input: { file_path: PATH } }, ROOT)).toBeNull();
  });

  it("reviews nothing after a tool whose name is not a string", () => {
    const payload = { hook_event_name: "PostToolUse", tool_name: 7, tool_input: { file_path: PATH } };

    expect(requestFrom(payload, ROOT)).toBeNull();
  });
});

describe("reading the permission mode", () => {
  it("takes the mode the payload carries", () => {
    expect(modeOf({ permission_mode: "acceptEdits" })).toBe("acceptEdits");
  });

  it("says nothing for a payload carrying no mode", () => {
    expect(modeOf({})).toBeNull();
  });

  it("says nothing for a payload that is not an object", () => {
    expect(modeOf(null)).toBeNull();
    expect(modeOf("acceptEdits")).toBeNull();
  });
});

const decision = (verdict: Decision["verdict"]): Decision => ({ verdict, reasons: ["first", "second"] });

describe("answering the hook before the write", () => {
  it("refuses in the words of a refusal", () => {
    expect(JSON.parse(verdictFor(decision("deny")) ?? "")).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "This edit is refused by the project's architecture rules.\n\nfirst\n\nsecond",
      },
    });
  });

  it("asks in the words of a question, which is a different sentence", () => {
    const reason: string = JSON.parse(verdictFor(decision("ask")) ?? "").hookSpecificOutput
      .permissionDecisionReason;

    expect(reason.split("\n")[0]).toBe(
      "This edit needs your approval under the project's architecture rules.",
    );
  });

  it("stays silent on an allowance, so the hook adds nothing", () => {
    expect(verdictFor(decision("allow"))).toBeNull();
  });
});

describe("answering the hook after the write", () => {
  it("hands back context rather than a verdict, since the write already happened", () => {
    expect(JSON.parse(contextFor(decision("deny"), false) ?? "")).toEqual({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext:
          "That edit broke one of the project's architecture rules. Repair it before moving on.\n\nfirst\n\nsecond",
      },
    });
  });

  it("says the findings may pre-date a change that could have touched any file", () => {
    const said = JSON.parse(contextFor(decision("deny"), true) ?? "").hookSpecificOutput.additionalContext;

    expect(said.split("\n")[0]).toBe(
      "That change could have touched any file, so this is the whole project. Some of it may pre-date the change; repair what the change caused.",
    );
  });

  it("does not blame the change for findings it cannot have caused", () => {
    const said = JSON.parse(contextFor(decision("deny"), true) ?? "").hookSpecificOutput.additionalContext;

    expect(said).not.toContain("That edit broke");
  });

  it("stays silent on an allowance", () => {
    expect(contextFor(decision("allow"), false)).toBeNull();
    expect(contextFor(decision("allow"), true)).toBeNull();
  });
});
