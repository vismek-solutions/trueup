import { relative } from "node:path";
import picomatch from "picomatch";
import { toPosix } from "../paths/posix.ts";
import { nested } from "./nesting.ts";
import type { Protection, ProtectionRule } from "../ports/protection.ts";
import type { Decision, Verdict } from "../ports/proposal.ts";

const CLAIM = "no-edit-changes-the-rules-themselves";

const ASK_GUIDANCE = `An agent is asking to change a protected file.

Approve it if this is setup, or a change you meant to make.

Refuse it if a check was failing just before this. Editing this file is how a failing check gets switched off.`;

const DENY_GUIDANCE = `This file is protected. Changing it to make a check pass switches the check off and leaves no trace.

Do this:
- If the code is wrong, fix the code.
- If the rule is wrong, say so, leave the check failing, and let a person decide.`;

const ALLOW: Decision = { verdict: "allow", reasons: [] };

const ASKS_NOBODY = new Set(["acceptEdits", "auto", "dontAsk", "bypassPermissions"]);

export interface ProtectionInput {
  readonly root: string;
  readonly path: string;
  readonly always: readonly string[];
  readonly protect: Protection | undefined;
  readonly mode: string | null;
}

export const pathsIn = (protect: Protection | undefined): readonly string[] => {
  if (protect === undefined) return [];
  if (Array.isArray(protect)) return protect;
  return (protect as ProtectionRule).paths ?? [];
};

const verdictIn = (protect: Protection | undefined): Verdict => {
  if (protect === undefined || Array.isArray(protect)) return "ask";
  return (protect as ProtectionRule).decision ?? "ask";
};

export const rulebookGuarded = (protect: Protection | undefined): boolean => verdictIn(protect) !== "allow";

const covered = ({ root, path, always, protect }: ProtectionInput): boolean => {
  if (always.includes(path)) return true;

  const patterns = pathsIn(protect);
  if (patterns.length === 0) return false;
  return picomatch([...patterns], { dot: true })(toPosix(relative(root, path)));
};

const settled = (protect: Protection | undefined, mode: string | null): Verdict => {
  const wanted = verdictIn(protect);
  if (wanted === "allow" || wanted === "deny") return wanted;
  return mode !== null && ASKS_NOBODY.has(mode) ? "deny" : "ask";
};

export function protectionOf(input: ProtectionInput): Decision {
  if (!covered(input)) return ALLOW;

  const verdict = settled(input.protect, input.mode);
  if (verdict === "allow") return ALLOW;
  const guidance = verdict === "deny" ? DENY_GUIDANCE : ASK_GUIDANCE;
  const where = toPosix(relative(input.root, input.path)) || input.path;

  return { verdict, reasons: [`${CLAIM}  ${where}\n${nested(guidance)}`] };
}
