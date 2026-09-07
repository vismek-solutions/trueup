import { relative, sep } from "node:path";
import picomatch from "picomatch";
import type { Decision } from "../ports/proposal.ts";

const CLAIM = "no-edit-changes-the-rules-themselves";

const GUIDANCE =
  "This file is the rulebook the other checks are read from, so an edit to it is not governed by anything. Changing it to make a check pass switches the check off, and leaves no trace that it ever failed. If the code is wrong, fix the code. If the rule is genuinely wrong, say so, leave the check failing, and let a person decide — that judgement is not this edit's to make.";

const ALLOW: Decision = { blocked: false, reasons: [] };

const posix = (path: string): string => (sep === "/" ? path : path.split(sep).join("/"));

export interface ProtectionInput {
  readonly root: string;
  readonly path: string;
  readonly always: readonly string[];
  readonly patterns: readonly string[];
}

const covered = ({ root, path, always, patterns }: ProtectionInput): boolean => {
  if (always.includes(path)) return true;
  if (patterns.length === 0) return false;
  return picomatch([...patterns], { dot: true })(posix(relative(root, path)));
};

export function protectionOf(input: ProtectionInput): Decision {
  if (!covered(input)) return ALLOW;

  const where = posix(relative(input.root, input.path)) || input.path;
  return { blocked: true, reasons: [`${CLAIM}  ${where}\n  ${GUIDANCE}`] };
}
