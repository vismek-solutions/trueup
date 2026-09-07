import { ALLOW, type Decision } from "../ports/proposal.ts";
import type { Report } from "../report/model.ts";

export interface DecideInput {
  readonly report: Report;
  readonly path: string;
}

export function decideOnProposal({ report, path }: DecideInput): Decision {
  const reasons = report.claims.flatMap((claim) =>
    claim.findings
      .filter((finding) => finding.severity === "error" && finding.file === path)
      .map((finding) => `${claim.claim} — ${finding.message}`),
  );

  return reasons.length === 0 ? ALLOW : { blocked: true, reasons };
}
