import { relative } from "node:path";
import { DEFAULT_COMMAND } from "../report/invocation.ts";
import type { Finding, Report } from "../report/model.ts";
import { locator, type Locate } from "./position.ts";

const locate = (root: string, finding: Finding, at: Locate): string => {
  if (finding.file === null) return "";
  const position = at(finding.file, finding.start);
  const shown = position === null ? "" : `:${position.line}:${position.column}`;
  return `${relative(root, finding.file)}${shown}`;
};

const listed = (findings: readonly Finding[], root: string, at: Locate): readonly string[] =>
  findings.map((finding) => {
    const where = locate(root, finding, at);
    return where === "" ? `    ${finding.message}` : `    ${where}  ${finding.message}`;
  });

const flowed = (line: string, width: number): string[] => {
  const hang = line.startsWith("- ") ? "  " : "";
  const lines: string[] = [];

  for (const word of line.split(" ")) {
    const last = lines[lines.length - 1];
    if (last === undefined) lines.push(word);
    else if (`${last} ${word}`.length > width) lines.push(`${hang}${word}`);
    else lines[lines.length - 1] = `${last} ${word}`;
  }

  return lines;
};

const wrap = (text: string, width: number): string[] =>
  text.split("\n").flatMap((line) => (line === "" ? [""] : flowed(line, width)));

const RULE = "    ────────";

const said = (guidance: string): string[] => [
  RULE,
  ...wrap(guidance, 96).map((line) => (line === "" ? "" : `    ${line}`)),
];

export interface RatchetSummary {
  readonly known: number;
  readonly stale: number;
}

export const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

const errorsIn = (findings: readonly Finding[]): number =>
  findings.filter((finding) => finding.severity === "error").length;

const tallyOf = (findings: readonly Finding[]): string => {
  if (findings.length === 0) return "ok";

  const errors = errorsIn(findings);
  const warnings = findings.length - errors;

  return [errors > 0 ? plural(errors, "error") : "", warnings > 0 ? plural(warnings, "warning") : ""]
    .filter(Boolean)
    .join(" · ");
};

const headerOf = (report: Report, ratchet: RatchetSummary | undefined): string[] => {
  const { coverage } = report;
  const zones = Object.entries(coverage.filesByZone)
    .map(([name, count]) => `${name} ${count}`)
    .join(" · ");

  return [
    `coverage  ${coverage.files} files · ${coverage.edges} edges · ${coverage.symbolEdges} symbol · ${coverage.externalEdges} external · ${coverage.builtinEdges} builtin · ${coverage.unresolvedImports} unresolved`,
    `zones     ${zones || "none"} · ${coverage.unclassifiedFiles} unclassified`,
    ...(ratchet === undefined ? [] : [`baseline  ${ratchet.known} known · ${ratchet.stale} stale`]),
    ...(report.notices ?? []).map((notice) => `notice    ${notice}`),
    "",
  ];
};

interface ClaimLinesInput {
  readonly root: string;
  readonly width: number;
  readonly at: Locate;
}

const claimLines = (claim: Report["claims"][number], { root, width, at }: ClaimLinesInput): string[] => {
  const lines = [`${claim.claim.padEnd(width)}${tallyOf(claim.findings)}`];

  for (const finding of claim.findings) {
    const where = locate(root, finding, at);
    lines.push(where === "" ? `    ${finding.message}` : `    ${where}  ${finding.message}`);
  }

  if (claim.findings.length === 0) return lines;

  return [...lines, ...said(claim.guidance), ""];
};

const markOf = (findings: readonly Finding[]): string => {
  if (errorsIn(findings) > 0) return "E";
  return findings.length === 0 ? "." : "!";
};

const tallyLine = (report: Report): string => {
  const total = report.claims.flatMap((claim) => claim.findings);
  const errors = errorsIn(total);

  return [
    plural(report.claims.length, "claim"),
    plural(errors, "error"),
    plural(total.length - errors, "warning"),
  ].join(" · ");
};

interface Problem {
  readonly claim: Report["claims"][number];
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

const scopeOf = (only: string | undefined): string => (only === undefined ? "" : ` in \`${only}\``);

export interface NextInput {
  readonly ratchet?: RatchetSummary | undefined;
  readonly only?: string | undefined;
  readonly command?: string | undefined;
}

const failing = (finding: Finding): boolean => finding.severity === "error";

const accepted = (finding: Finding): boolean => finding.accepted === true;

interface BlockInput {
  readonly root: string;
  readonly tally: string;
  readonly after?: readonly string[] | undefined;
}

const blockFor = (problem: Problem, { root, tally, after = [] }: BlockInput): string[] => [
  "",
  `${problem.claim.claim}  ${tally}`,
  ...listed(problem.findings, root, locator()),
  ...said(problem.claim.guidance),
  ...after,
];

export function renderNext(report: Report, root: string, options: NextInput = {}): string {
  const { ratchet, only, command = DEFAULT_COMMAND } = options;
  const claims = only === undefined ? report.claims : report.claims.filter((c) => c.claim.includes(only));
  const tally = tallyLine(report);

  if (claims.length === 0 && only !== undefined) {
    return [
      `no claim matches \`${only}\` · ${tally}`,
      "",
      ...report.claims.map((claim) => `    ${claim.claim}`),
    ].join("\n");
  }

  const scoped = { ...report, claims };
  const problems = problemsIn(scoped, failing);
  const first = problems[0];

  if (first !== undefined) {
    return [
      `problem 1 of ${problems.length}${scopeOf(only)} · ${tally}`,
      ...blockFor(first, { root, tally: plural(first.findings.length, "error") }),
    ].join("\n");
  }

  const debts = problemsIn(scoped, accepted);
  const owed = debts[0];
  const stale = ratchet === undefined || ratchet.stale === 0 ? "" : `${ratchet.stale} stale`;

  if (owed === undefined) {
    return [
      `nothing left to fix${scopeOf(only)} · ${tally}`,
      ...(stale === "" ? [] : [`baseline  ${stale}`]),
    ].join("\n");
  }

  return [
    `nothing failing${scopeOf(only)} · ${tally}`,
    `baseline  1 of ${debts.length} accepted${stale === "" ? "" : ` · ${stale}`}`,
    ...blockFor(owed, {
      root,
      tally: `${owed.findings.length} accepted`,
      after: [`    Fixing this one also needs \`${command} --update-baseline\` to drop its entry.`],
    }),
  ].join("\n");
}

export function renderDots(report: Report, root: string, ratchet?: RatchetSummary): string {
  const at = locator();
  const { coverage } = report;
  const failed = report.claims.filter((claim) => errorsIn(claim.findings) > 0);
  const width = Math.max(44, ...failed.map((claim) => claim.claim.length + 2));

  const detail = failed.flatMap((claim) => {
    const hits = claim.findings.filter((finding) => finding.severity === "error");
    const shown = listed(hits, root, at);

    return [
      "",
      `${claim.claim.padEnd(width)}${plural(hits.length, "error")}`,
      ...shown,
      ...said(claim.guidance),
    ];
  });

  return [
    `${report.claims.map((claim) => markOf(claim.findings)).join("")}  ${coverage.files} files · ${coverage.edges} edges · ${coverage.unresolvedImports} unresolved`,
    ...(ratchet === undefined ? [] : [`baseline  ${ratchet.known} known · ${ratchet.stale} stale`]),
    ...(report.notices ?? []).map((notice) => `notice    ${notice}`),
    ...detail,
    "",
    tallyLine(report),
  ].join("\n");
}

export function render(report: Report, root: string, ratchet?: RatchetSummary): string {
  const input: ClaimLinesInput = {
    root,
    width: Math.max(44, ...report.claims.map((claim) => claim.claim.length + 2)),
    at: locator(),
  };

  return [
    ...headerOf(report, ratchet),
    ...report.claims.flatMap((claim) => claimLines(claim, input)),
    "",
    tallyLine(report),
  ].join("\n");
}
