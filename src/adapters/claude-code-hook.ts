import { readFileSync } from "node:fs";
import type { Decision, Proposal } from "../ports/proposal.ts";

interface HookPayload {
  readonly tool_name?: unknown;
  readonly tool_input?: {
    readonly file_path?: unknown;
    readonly content?: unknown;
    readonly old_string?: unknown;
    readonly new_string?: unknown;
    readonly replace_all?: unknown;
  };
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

export function proposalFrom(payload: unknown): Proposal | null {
  if (payload === null || typeof payload !== "object") return null;
  const { tool_name: tool, tool_input: input } = payload as HookPayload;
  if (input === undefined || typeof input.file_path !== "string") return null;
  const path = input.file_path;

  if (tool === "Write") {
    return typeof input.content === "string" ? { path, text: input.content } : null;
  }

  if (tool === "Edit") {
    if (typeof input.old_string !== "string" || typeof input.new_string !== "string") return null;
    const text = editedText(path, input.old_string, input.new_string, input.replace_all === true);
    return text === null ? null : { path, text };
  }

  return null;
}

export function denialFor(decision: Decision): string | null {
  if (!decision.blocked) return null;

  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: [
        "This edit would break the project's architecture.",
        "",
        ...decision.reasons,
      ].join("\n"),
    },
  });
}
