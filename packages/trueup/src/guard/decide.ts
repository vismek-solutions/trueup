import { relative } from "node:path";
import type { Decision } from "../ports/proposal.ts";
import type { Finding, Report } from "../report/model.ts";
import { nested } from "./nesting.ts";

const ALLOW: Decision = { verdict: "allow", reasons: [] };

export interface DecideInput {
  readonly report: Report;
  readonly path: string | null;
  readonly root: string;
}

const shortened = (root: string, file: string): string => relative(root, file) || file;

const lineOf = (root: string, scoped: boolean, hit: Finding): string => {
  if (scoped || hit.file === null) return `  ${hit.message}`;
  return `  ${shortened(root, hit.file)}  ${hit.message}`;
};

export function decideOnProposal({ report, path, root }: DecideInput): Decision {
  const scoped = path !== null;

  const reasons = report.claims.flatMap((claim) => {
    const hits = claim.findings.filter(
      (finding) => finding.severity === "error" && (path === null || finding.file === path),
    );
    if (hits.length === 0) return [];

    const header = path === null ? claim.claim : `${claim.claim}  ${shortened(root, path)}`;
    const lines = hits.map((hit) => lineOf(root, scoped, hit));
    return [[header, ...lines, nested(claim.guidance)].join("\n")];
  });

  return reasons.length === 0 ? ALLOW : { verdict: "deny", reasons };
}
