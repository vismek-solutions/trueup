import { relative } from "node:path";
import type { Decision } from "../ports/proposal.ts";
import type { Report } from "../report/model.ts";

const ALLOW: Decision = { blocked: false, reasons: [] };

export interface DecideInput {
  readonly report: Report;
  readonly path: string;
  readonly root: string;
}

export function decideOnProposal({ report, path, root }: DecideInput): Decision {
  const where = relative(root, path) || path;

  const reasons = report.claims.flatMap((claim) => {
    const hits = claim.findings.filter((finding) => finding.severity === "error" && finding.file === path);
    if (hits.length === 0) return [];

    return [
      [claim.claim, ...hits.map((hit) => `  ${where}  ${hit.message}`), `  ${claim.guidance}`].join("\n"),
    ];
  });

  return reasons.length === 0 ? ALLOW : { blocked: true, reasons };
}
