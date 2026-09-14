import { join, relative } from "node:path";
import type { Baseline, BaselineEntry } from "../ports/baseline.ts";
import type { ClaimResult, Finding, Report } from "../report/model.ts";
import type { Acceptance, RatchetResult } from "./model.ts";

export const STALE_CLAIM = "every-baseline-entry-is-still-needed";

const NEVER_BASELINED = new Set([
  "the-analysis-reached-files",
  "every-delegated-tool-ran",
  "no-change-outgrows-its-review",
]);

type Key = (entry: BaselineEntry) => string;

const onePerFileIn = (report: Report): ReadonlySet<string> =>
  new Set(report.claims.filter((claim) => claim.onePerFile === true).map((claim) => claim.claim));

const keying =
  (onePerFile: ReadonlySet<string>): Key =>
  (entry) =>
    onePerFile.has(entry.claim) && entry.file !== null
      ? `${entry.claim}\0${entry.file}`
      : `${entry.claim}\0${entry.file ?? ""}\0${entry.message}`;

const entryOf = (claim: string, finding: Finding, root: string): BaselineEntry => ({
  claim,
  file: finding.file === null ? null : relative(root, finding.file),
  message: finding.message,
});

const byEntry = (key: Key) => (left: BaselineEntry, right: BaselineEntry) =>
  key(left) < key(right) ? -1 : 1;

export function baselineOf(report: Report, root: string): Baseline {
  const key = keying(onePerFileIn(report));
  const entries = report.claims
    .filter((claim) => !NEVER_BASELINED.has(claim.claim))
    .flatMap((claim) => claim.findings.map((finding) => entryOf(claim.claim, finding, root)));

  const unique = new Map(entries.map((entry) => [key(entry), entry]));
  return { entries: [...unique.values()].sort(byEntry(key)) };
}

export interface ComparedBaselines {
  readonly next: Baseline;
  readonly previous: Baseline;
  readonly report: Report;
}

export function acceptanceOf({ next, previous, report }: ComparedBaselines): Acceptance {
  const key = keying(onePerFileIn(report));
  const had = new Set(previous.entries.map(key));
  const has = new Set(next.entries.map(key));

  return {
    added: next.entries.filter((entry) => !had.has(key(entry))),
    retired: previous.entries.filter((entry) => !has.has(key(entry))),
    first: had.size === 0,
  };
}

const stillReporting = (claims: readonly ClaimResult[], root: string): ReadonlySet<string> => {
  const open = new Set<string>();

  for (const claim of claims) {
    for (const finding of claim.findings) {
      if (finding.accepted === true || finding.file === null) continue;
      open.add(`${claim.claim}\0${relative(root, finding.file)}`);
    }
  }

  return open;
};

const retiredIn = (stale: readonly BaselineEntry[]): ReadonlySet<string> =>
  new Set(
    stale.flatMap((entry) => (entry.file === null ? [] : [`${entry.claim}\0${entry.file}`])),
  );

const standingIn = (
  claims: readonly ClaimResult[],
  retired: ReadonlySet<string>,
  root: string,
): ClaimResult[] =>
  claims.map((claim) => {
    const replaces = (finding: Finding): boolean =>
      finding.accepted !== true &&
      finding.file !== null &&
      retired.has(`${claim.claim}\0${relative(root, finding.file)}`);

    return {
      ...claim,
      findings: claim.findings.map((finding) =>
        replaces(finding) ? { ...finding, reworded: true } : finding,
      ),
    };
  });

const saidOf = (entry: BaselineEntry, reworded: ReadonlySet<string>): string => {
  if (entry.file !== null && reworded.has(`${entry.claim}\0${entry.file}`)) {
    return `${entry.claim} still reports on this file in other words: ${entry.message}`;
  }

  return `${entry.claim} no longer reports this: ${entry.message}`;
};

export interface ApplyBaselineInput {
  readonly report: Report;
  readonly baseline: Baseline;
  readonly root: string;
}

export function applyBaseline({ report, baseline, root }: ApplyBaselineInput): RatchetResult {
  const keyOf = keying(onePerFileIn(report));
  const known = new Set(baseline.entries.map(keyOf));
  const matched = new Set<string>();
  let downgraded = 0;

  const claims: ClaimResult[] = report.claims.map((claim) => {
    if (NEVER_BASELINED.has(claim.claim)) return claim;

    return {
      ...claim,
      findings: claim.findings.map((finding) => {
        const key = keyOf(entryOf(claim.claim, finding, root));
        if (!known.has(key)) return finding;
        matched.add(key);
        downgraded += 1;
        return { ...finding, severity: "warning" as const, accepted: true };
      }),
    };
  });

  const stale = baseline.entries.filter((entry) => !matched.has(keyOf(entry)));
  const reworded = stillReporting(claims, root);
  const settled = standingIn(claims, retiredIn(stale), root);

  settled.push({
    claim: STALE_CLAIM,
    guidance: [
      "These baseline entries match nothing any more.",
      "",
      "Do this:",
      "- Run `{trueup} --update-baseline` to drop them.",
      "",
      "An entry saying the claim still reports on that file is not a fix. The same problem is standing under different words, it is failing now, and updating the baseline records the new wording rather than dropping anything.",
      "",
      "Left in place they become permanent exemptions nobody audits.",
    ].join("\n"),
    findings: stale.map((entry) => ({
      severity: "warning" as const,
      message: saidOf(entry, reworded),
      file: entry.file === null ? null : join(root, entry.file),
      start: null,
    })),
  });

  return { report: { ...report, claims: settled }, known: downgraded, stale: stale.length };
}
