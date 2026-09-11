import { relative } from "node:path";
import picomatch from "picomatch";
import { toPosix } from "../paths/posix.ts";
import type { Protection, ProtectionRule } from "../ports/protection.ts";
import type { Decision, Verdict } from "../ports/proposal.ts";

const CLAIM = "no-edit-changes-the-rules-themselves";

const ASK_GUIDANCE =
  "An agent is asking to change a file the project's rules are read from. Approve it if this is setup, or a change to the rules you meant to make. Refuse it if a check was failing just before this: editing the rulebook is how a failing check gets switched off, and it leaves no trace that it ever failed.";

const DENY_GUIDANCE =
  "This file is the rulebook the other checks are read from, so an edit to it is not governed by anything. Changing it to make a check pass switches the check off, and leaves no trace that it ever failed. If the code is wrong, fix the code. If the rule is genuinely wrong, say so, leave the check failing, and let a person decide, because that judgement is not this edit's to make.";

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

  return { verdict, reasons: [`${CLAIM}  ${where}\n  ${guidance}`] };
}
