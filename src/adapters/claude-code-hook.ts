import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { Decision, HookRequest, Proposal } from "../ports/proposal.ts";
import { stringOf } from "./tool-output.ts";

const SERENA_REPLACE = "mcp__serena__replace_content";

interface HookPayload {
  readonly hook_event_name?: unknown;
  readonly tool_name?: unknown;
  readonly tool_input?: Record<string, unknown>;
}

const editedText = (path: string, from: string, to: string, all: boolean): string | null => {
  let current: string;
  try {
    current = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  if (!current.includes(from)) return null;
  return all ? current.replaceAll(from, to) : current.replace(from, to);
};

const replacementIn = (
  path: string,
  from: string | null,
  to: string | null,
  all: boolean,
): Proposal | null => {
  if (from === null || to === null) return null;
  const text = editedText(path, from, to, all);
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
    return replacementIn(path, stringOf(input.old_string), stringOf(input.new_string), all);
  }

  if (tool === SERENA_REPLACE && input.mode === "literal") {
    const all = input.allow_multiple_occurrences === true;
    return replacementIn(path, stringOf(input.needle), stringOf(input.repl), all);
  }

  return null;
};

export function requestFrom(payload: unknown, root: string): HookRequest | null {
  if (payload === null || typeof payload !== "object") return null;
  const { hook_event_name: event, tool_name: tool, tool_input: input } = payload as HookPayload;
  if (input === undefined || typeof tool !== "string") return null;

  if (event === "PostToolUse") return { kind: "review", path: fileIn(root, input) };

  const proposal = proposalIn(tool, input, root);
  return proposal === null ? null : { kind: "propose", proposal };
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

export function contextFor(decision: Decision): string | null {
  if (decision.verdict === "allow") return null;

  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: [
        "That edit broke one of the project's architecture rules. Repair it before moving on.",
        "",
        ...decision.reasons,
      ].join("\n"),
    },
  });
}
