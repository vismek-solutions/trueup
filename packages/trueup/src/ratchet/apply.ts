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

const countedBy = (key: Key, entries: readonly BaselineEntry[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const at = key(entry);
    counts.set(at, (counts.get(at) ?? 0) + 1);
  }

  return counts;
};

const takenFrom =(counts: Map<string, number>, at: string): boolean => {
  const left = counts.get(at) ?? 0;
  if (left === 0) return false;
  counts.set(at, left - 1);

  return true;
};

const byEntry = (key: Key) => (left: BaselineEntry, right: BaselineEntry) => {
  const first = key(left);
  const second = key(right);
  if (first === second) return 0;

  return first < second ? -1 : 1;
};

export function baselineOf(report: Report, root: string): Baseline {
  const entries = report.claims
    .filter((claim) => !NEVER_BASELINED.has(claim.claim))
    .flatMap((claim) => claim.findings.map((finding) => entryOf(claim.claim, finding, root)));

  return { entries: entries.sort(byEntry(keying(onePerFileIn(report)))) };
}

export interface ComparedBaselines {
  readonly next: Baseline;
  readonly previous: Baseline;
  readonly report: Report;
}

export function acceptanceOf({ next, previous, report }: ComparedBaselines): Acceptance {
  const key = keying(onePerFileIn(report));
  const had = countedBy(key, previous.entries);
  const has = countedBy(key, next.entries);

  return {
    added: next.entries.filter((entry) => !takenFrom(had, key(entry))),
    retired: previous.entries.filter((entry) => !takenFrom(has, key(entry))),
    first: previous.entries.length === 0,
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
  const unmatched = countedBy(keyOf, baseline.entries);
  let downgraded = 0;

  const claims: ClaimResult[] = report.claims.map((claim) => {
    if (NEVER_BASELINED.has(claim.claim)) return claim;

    return {
      ...claim,
      findings: claim.findings.map((finding) => {
        if (!takenFrom(unmatched, keyOf(entryOf(claim.claim, finding, root)))) return finding;
        downgraded += 1;
        return { ...finding, severity: "warning" as const, accepted: true };
      }),
    };
  });

  const stale = baseline.entries.filter((entry) => takenFrom(unmatched, keyOf(entry)));
  const reworded = stillReporting(claims, root);
  const settled = standingIn(claims, retiredIn(stale), root);

  settled.push({
    claim: STALE_CLAIM,
    guidance: `These baseline entries match nothing any more.

Do this:
- Run \`{trueup} --update-baseline\` to drop them.

An entry saying the claim still reports on that file is not a fix. The same problem is standing under different words, it is failing now, and updating the baseline records the new wording rather than dropping anything.

Left in place they become permanent exemptions nobody audits.`,
    findings: stale.map((entry) => ({
      severity: "warning" as const,
      message: saidOf(entry, reworded),
      file: entry.file === null ? null : join(root, entry.file),
      start: null,
    })),
  });

  return { report: { ...report, claims: settled }, known: downgraded, stale: stale.length };
}
