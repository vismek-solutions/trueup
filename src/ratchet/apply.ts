import { join, relative } from "node:path";
import type { Baseline, BaselineEntry } from "../ports/baseline.ts";
import type { ClaimResult, Finding, Report } from "../report/model.ts";
import type { RatchetResult } from "./model.ts";

export const STALE_CLAIM = "every-baseline-entry-is-still-needed";

const NEVER_BASELINED = new Set(["the-analysis-reached-files", "every-delegated-tool-ran"]);

const keyOf = (entry: BaselineEntry): string => `${entry.claim}\0${entry.file ?? ""}\0${entry.message}`;

const entryOf = (claim: string, finding: Finding, root: string): BaselineEntry => ({
  claim,
  file: finding.file === null ? null : relative(root, finding.file),
  message: finding.message,
});

const byEntry = (left: BaselineEntry, right: BaselineEntry): number => {
  const before = keyOf(left);
  const after = keyOf(right);
  if (before < after) return -1;
  return before > after ? 1 : 0;
};

export function baselineOf(report: Report, root: string): Baseline {
  const entries = report.claims
    .filter((claim) => !NEVER_BASELINED.has(claim.claim))
    .flatMap((claim) => claim.findings.map((finding) => entryOf(claim.claim, finding, root)));

  const unique = new Map(entries.map((entry) => [keyOf(entry), entry]));
  return { entries: [...unique.values()].sort(byEntry) };
}

export interface ApplyBaselineInput {
  readonly report: Report;
  readonly baseline: Baseline;
  readonly root: string;
}

export function applyBaseline({ report, baseline, root }: ApplyBaselineInput): RatchetResult {
  const known = new Set(baseline.entries.map(keyOf));
  const matched = new Set<string>();
  let downgraded = 0;

  const claims: ClaimResult[] = report.claims.map((claim) => {
    if (NEVER_BASELINED.has(claim.claim)) return claim;

    return {
      claim: claim.claim,
      guidance: claim.guidance,
      findings: claim.findings.map((finding) => {
        const key = keyOf(entryOf(claim.claim, finding, root));
        if (!known.has(key)) return finding;
        matched.add(key);
        downgraded += 1;
        return { ...finding, severity: "warning" as const };
      }),
    };
  });

  const stale = baseline.entries.filter((entry) => !matched.has(keyOf(entry)));

  claims.push({
    claim: STALE_CLAIM,
    guidance:
      "These baseline entries match nothing any more, so the violations they recorded are fixed. Run `{trueline} --update-baseline` to drop them. Left in place they become permanent exemptions nobody audits.",
    findings: stale.map((entry) => ({
      severity: "warning" as const,
      message: `${entry.claim} no longer reports this: ${entry.message}`,
      file: entry.file === null ? null : join(root, entry.file),
      start: null,
    })),
  });

  return { report: { claims, coverage: report.coverage }, known: downgraded, stale: stale.length };
}
