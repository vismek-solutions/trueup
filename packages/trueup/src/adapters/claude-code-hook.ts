import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { Decision, HookRequest, Proposal } from "../ports/proposal.ts";
import { stringOf } from "./tool-output.ts";

const SERENA_REPLACE = "mcp__serena__replace_content";

const EDITS_BEYOND_ITS_PATH = new Set([
  "mcp__serena__rename_symbol",
  "mcp__serena__safe_delete_symbol",
  "mcp__serena__replace_in_files",
]);

interface HookPayload {
  readonly hook_event_name?: unknown;
  readonly permission_mode?: unknown;
  readonly tool_name?: unknown;
  readonly tool_input?: Record<string, unknown>;
}

interface Replacement {
  readonly from: string | null;
  readonly to: string | null;
  readonly all: boolean;
}

const editedText = (path: string, { from, to, all }: Replacement): string | null => {
  if (from === null || to === null) return null;

  let current: string;
  try {
    current = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  if (!current.includes(from)) return null;
  return all ? current.replaceAll(from, to) : current.replace(from, to);
};

const replacementIn = (path: string, replacement: Replacement): Proposal | null => {
  const text = editedText(path, replacement);
  return text === null ? null : { path, text };
};

const fileIn = (root: string, input: Record<string, unknown>): string | null => {
  const absolute = stringOf(input.file_path);
  if (absolute !== null) return absolute;

  const named = stringOf(input.relative_path);
  if (named === null || named === "") return null;
  return isAbsolute(named) ? named : join(root, named);
};

const proposalIn = (tool: string, input: Record<string, unknown>, root: string): Proposal | null => {
  const path = fileIn(root, input);
  if (path === null) return null;

  if (tool === "Write") {
    const content = stringOf(input.content);
    return content === null ? null : { path, text: content };
  }

  if (tool === "Edit") {
    const all = input.replace_all === true;
    return replacementIn(path, { from: stringOf(input.old_string), to: stringOf(input.new_string), all });
  }

  if (tool === SERENA_REPLACE && input.mode === "literal") {
    const all = input.allow_multiple_occurrences === true;
    return replacementIn(path, { from: stringOf(input.needle), to: stringOf(input.repl), all });
  }

  return null;
};

export function requestFrom(payload: unknown, root: string): HookRequest | null {
  if (payload === null || typeof payload !== "object") return null;
  const { hook_event_name: event, tool_name: tool, tool_input: input } = payload as HookPayload;
  if (input === undefined || typeof tool !== "string") return null;

  if (event === "PostToolUse") {
    const path = fileIn(root, input);
    return { kind: "review", path, spread: path === null || EDITS_BEYOND_ITS_PATH.has(tool) };
  }

  const proposal = proposalIn(tool, input, root);
  return proposal === null ? null : { kind: "propose", proposal };
}

export function modeOf(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object") return null;
  return stringOf((payload as HookPayload).permission_mode);
}

export function verdictFor(decision: Decision): string | null {
  if (decision.verdict === "allow") return null;

  const headline =
    decision.verdict === "deny"
      ? "This edit is refused by the project's architecture rules."
      : "This edit needs your approval under the project's architecture rules.";

  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision.verdict,
      permissionDecisionReason: [headline, "", ...decision.reasons].join("\n"),
    },
  });
}

export function contextFor(decision: Decision, spread: boolean): string | null {
  if (decision.verdict === "allow") return null;

  const headline = spread
    ? "That change could have touched any file, so this is the whole project. Some of it may pre-date the change; repair what the change caused."
    : "That edit broke one of the project's architecture rules. Repair it before moving on.";

  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: [headline, "", ...decision.reasons].join("\n"),
    },
  });
}
