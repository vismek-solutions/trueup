import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { Decision, HookRequest, Proposal } from "../ports/proposal.ts";
import { stringOf } from "./tool-output.ts";

const MCP_TOOL = /^mcp__.+?__(.+)$/;

const SERENA_REPLACE = "replace_content";

const EDITS_BEYOND_ITS_PATH = new Set(["rename_symbol", "safe_delete_symbol", "replace_in_files"]);

const REVIEW_EVENTS = new Set(["PostToolUse", "postToolUse"]);

export type Host = "claude" | "cursor";

// the hook's matcher picks the server, so any server name carries the same tool
const mcpToolOf = (tool: string): string | null => MCP_TOOL.exec(tool)?.[1] ?? null;

interface HookPayload {
  readonly hook_event_name?: unknown;
  readonly cursor_version?: unknown;
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

  if (mcpToolOf(tool) === SERENA_REPLACE && input.mode === "literal") {
    const all = input.allow_multiple_occurrences === true;
    return replacementIn(path, { from: stringOf(input.needle), to: stringOf(input.repl), all });
  }

  return null;
};

export function requestFrom(payload: unknown, root: string): HookRequest | null {
  if (payload === null || typeof payload !== "object") return null;
  const { hook_event_name: event, tool_name: tool, tool_input: input } = payload as HookPayload;
  if (input === undefined || typeof tool !== "string") return null;

  if (typeof event === "string" && REVIEW_EVENTS.has(event)) {
    const path = fileIn(root, input);
    const spread = path === null || EDITS_BEYOND_ITS_PATH.has(mcpToolOf(tool) ?? tool);
    return { kind: "review", path, spread };
  }

  const proposal = proposalIn(tool, input, root);
  return proposal === null ? null : { kind: "propose", proposal };
}

export const rebased = (request: HookRequest, path: string): HookRequest =>
  request.kind === "propose" ? { ...request, proposal: { ...request.proposal, path } } : { ...request, path };

// Cursor accepts ask on preToolUse without asking anyone
export function modeOf(payload: unknown): string | null {
  if (hostOf(payload) === "cursor") return "dontAsk";
  if (payload === null || typeof payload !== "object") return null;
  return stringOf((payload as HookPayload).permission_mode);
}

export function hostOf(payload: unknown): Host {
  if (payload === null || typeof payload !== "object") return "claude";
  return stringOf((payload as HookPayload).cursor_version) === null ? "claude" : "cursor";
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
      permissionDecisionReason: [headline, ...decision.reasons].join("\n\n"),
    },
  });
}

const headlineFor = (broke: boolean, spread: boolean): string => {
  if (!broke) return "Nothing is broken, but this is worth knowing before you go on.";

  return spread
    ? "That change could have touched any file, so this is the whole project. Some of it may pre-date the change; repair what the change caused."
    : "That edit broke one of the project's architecture rules. Repair it before moving on.";
};

export interface Framing {
  readonly spread: boolean;
  readonly notes?: readonly string[];
  readonly host?: Host;
}

export function contextFor(decision: Decision, { spread, notes = [], host = "claude" }: Framing): string | null {
  const broke = decision.verdict !== "allow";
  if (!broke && notes.length === 0) return null;

  const said = [headlineFor(broke, spread), ...decision.reasons, ...notes].join("\n\n");
  const claude = { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: said } };
  // Cursor reads only a top-level additional_context after a tool runs
  return JSON.stringify(host === "cursor" ? { additional_context: said, ...claude } : claude);
}
