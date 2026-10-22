import { DEFAULT_COMMAND } from "../../report/invocation.ts";
import type { ClaimResult, Finding, Report } from "../../report/model.ts";
import { type Attributes, items, listed, tagged } from "../tags.ts";
import { type Locate, locator } from "../position.ts";
import { countsOf, errorsIn, locate, plural, type RatchetSummary } from "../render.ts";

interface Problem {
  readonly claim: ClaimResult;
  readonly findings: readonly Finding[];
}

const keyOf = (claim: string, finding: Finding): string =>
  `${claim}\0${finding.group ?? `${finding.file ?? ""}\0${finding.start ?? ""}\0${finding.message}`}`;

const problemsIn = (report: Report, keep: (finding: Finding) => boolean): Problem[] => {
  const byKey = new Map<string, Problem>();

  for (const claim of report.claims) {
    for (const finding of claim.findings.filter(keep)) {
      const key = keyOf(claim.claim, finding);
      const found = byKey.get(key);
      if (found === undefined) byKey.set(key, { claim, findings: [finding] });
      else byKey.set(key, { claim, findings: [...found.findings, finding] });
    }
  }

  return [...byKey.values()];
};

const failing = (finding: Finding): boolean => finding.severity === "error";

const accepted = (finding: Finding): boolean => finding.accepted === true;

const scopeOf = (only: string | undefined): string => (only === undefined ? "" : ` in \`${only}\``);

const summaryOf = (report: Report, lead: string): readonly string[] =>
  tagged("summary", [...(lead === "" ? [] : [lead]), ...countsOf(report)].join(", "));

const findingLines = (findings: readonly Finding[], root: string, at: Locate): readonly string[] =>
  findings.map((finding) => {
    const where = locate(root, finding, at);
    return where === "" ? finding.message : `${where} ${finding.message}`;
  });

export interface ClaimTag {
  readonly attributes: Attributes;
  readonly findings: readonly string[];
  readonly guidance: string;
  readonly after?: readonly string[] | undefined;
}

export const claimTag = ({ attributes, findings, guidance, after = [] }: ClaimTag): readonly string[] =>
  tagged(
    "claim",
    [...listed("findings", findings), ...tagged("guidance", guidance.trim().split("\n")), ...after],
    attributes,
  );

interface ProblemTagInput {
  readonly root: string;
  readonly at: Locate;
  readonly counted: Attributes;
  readonly after?: readonly string[] | undefined;
}

const problemTag = ({ claim, findings }: Problem, { root, at, counted, after }: ProblemTagInput): readonly string[] =>
  claimTag({
    attributes: { name: claim.claim, ...counted },
    findings: findingLines(findings, root, at),
    guidance: claim.guidance,
    after,
  });

export const answering = (claims: readonly ClaimResult[], only: string): readonly ClaimResult[] =>
  claims.filter((claim) => claim.claim.includes(only) || claim.setting === only);

export interface NextInput {
  readonly ratchet?: RatchetSummary | undefined;
  readonly only?: string | undefined;
  readonly command?: string | undefined;
}

const unmatched = (report: Report, only: string): string =>
  [
    ...summaryOf(report, `no claim matches \`${only}\``),
    ...tagged(
      "claims",
      items(
        report.claims.map((claim) =>
          claim.setting === undefined ? claim.claim : `${claim.claim}, turned on by ${claim.setting}`,
        ),
      ),
    ),
  ].join("\n");

export function renderNext(report: Report, root: string, options: NextInput = {}): string {
  const { ratchet, only, command = DEFAULT_COMMAND } = options;
  const claims = only === undefined ? report.claims : answering(report.claims, only);

  if (claims.length === 0 && only !== undefined) return unmatched(report, only);

  const scoped = { ...report, claims };
  const at = locator();
  const problems = problemsIn(scoped, failing);
  const first = problems[0];

  if (first !== undefined) {
    return [
      ...summaryOf(report, `problem 1 of ${problems.length}${scopeOf(only)}`),
      "",
      ...problemTag(first, { root, at, counted: { errors: String(first.findings.length) } }),
    ].join("\n");
  }

  const debts = problemsIn(scoped, accepted);
  const owed = debts[0];
  const stale = ratchet === undefined || ratchet.stale === 0 ? "" : `${ratchet.stale} stale`;

  if (owed === undefined) {
    return [
      ...summaryOf(report, `nothing left to fix${scopeOf(only)}`),
      ...(stale === "" ? [] : tagged("baseline", stale)),
    ].join("\n");
  }

  return [
    ...summaryOf(report, `nothing failing${scopeOf(only)}`),
    ...tagged("baseline", [`1 of ${debts.length} accepted`, ...(stale === "" ? [] : [stale])].join(", ")),
    "",
    ...problemTag(owed, {
      root,
      at,
      counted: { accepted: String(owed.findings.length) },
      after: tagged("after-fixing", `Run \`${command} --update-baseline\` to drop its entry.`),
    }),
  ].join("\n");
}

const markOf = (findings: readonly Finding[]): string => {
  if (errorsIn(findings) > 0) return "E";
  return findings.length === 0 ? "." : "!";
};

export function renderDots(report: Report, root: string, ratchet?: RatchetSummary): string {
  const at = locator();
  const { coverage } = report;

  const detail = report.claims.flatMap((claim) => {
    const hits = claim.findings.filter(failing);
    if (hits.length === 0) return [];

    return ["", ...problemTag({ claim, findings: hits }, { root, at, counted: { errors: String(hits.length) } })];
  });

  return [
    ...tagged("marks", report.claims.map((claim) => markOf(claim.findings)).join("")),
    ...tagged(
      "coverage",
      `${plural(coverage.files, "file")}, ${plural(coverage.edges, "edge")}, ${coverage.unresolvedImports} unresolved`,
    ),
    ...(ratchet === undefined ? [] : tagged("baseline", `${ratchet.known} known, ${ratchet.stale} stale`)),
    ...(report.notices ?? []).flatMap((notice) => tagged("notice", notice)),
    ...detail,
    "",
    ...summaryOf(report, ""),
  ].join("\n");
}
