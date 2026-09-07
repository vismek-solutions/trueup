import { ALLOW, type Decision } from "../ports/proposal.ts";
import type { Report } from "../report/model.ts";

export interface DecideInput {
  readonly report: Report;
  readonly path: string;
}

export function decideOnProposal({ report, path }: DecideInput): Decision {
  const reasons = report.claims.flatMap((claim) => {
    const hits = claim.findings.filter((finding) => finding.severity === "error" && finding.file === path);
    if (hits.length === 0) return [];

    return [[claim.claim, ...hits.map((hit) => `  ${hit.message}`), `  ${claim.guidance}`].join("\n")];
  });

  return reasons.length === 0 ? ALLOW : { blocked: true, reasons };
}
