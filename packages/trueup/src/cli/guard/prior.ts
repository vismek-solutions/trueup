import { readSource } from "../../adapters/node-files.ts";
import { parseModule } from "../../adapters/oxc-parse.ts";
import type { HookRequest } from "../../ports/proposal.ts";
import type { Finding, Report } from "../../report/model.ts";

const ALREADY = " — already unresolved before this edit";

const importedBefore = (path: string): ReadonlySet<string> => {
  try {
    return new Set(parseModule(path, readSource(path)).imports.map((entry) => entry.specifier));
  } catch {
    return new Set<string>();
  }
};

export const markingPriorFailures = (report: Report, request: HookRequest, path: string | null): Report => {
  if (request.kind !== "propose" || path === null) return report;

  const before = importedBefore(path);
  if (before.size === 0) return report;

  return {
    ...report,
    claims: report.claims.map((claim) => ({
      ...claim,
      findings: claim.findings.map((finding) =>
        finding.file === path && finding.specifier !== undefined && before.has(finding.specifier)
          ? { ...finding, message: `${finding.message}${ALREADY}` }
          : finding,
      ),
    })),
  };
};

export const forgivingReWordings = (report: Report, request: HookRequest): Report => {
  if (request.kind !== "propose") return report;

  const kept = (finding: Finding): Finding =>
    finding.reworded === true ? { ...finding, severity: "warning" } : finding;

  return {
    ...report,
    claims: report.claims.map((claim) => ({ ...claim, findings: claim.findings.map(kept) })),
  };
};
