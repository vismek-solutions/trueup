import { relative } from "node:path";
import { messageLines, wrapped } from "../report/lines.ts";
import type { Finding, Report } from "../report/model.ts";
import { locator, type Locate } from "./position.ts";

export const locate = (root: string, finding: Finding, at: Locate): string => {
  if (finding.file === null) return "";
  const position = at(finding.file, finding.start);
  const shown = position === null ? "" : `:${position.line}:${position.column}`;
  return `${relative(root, finding.file)}${shown}`;
};

const INDENT = "    ";
const UNDER = "        ";

const listed = (findings: readonly Finding[], root: string, at: Locate): readonly string[] =>
  findings.flatMap((finding) => {
    const where = locate(root, finding, at);

    return messageLines({
      message: finding.message,
      head: where === "" ? INDENT : `${INDENT}${where}  `,
      indent: UNDER,
    });
  });

const RULE = "    ────────";

const said = (guidance: string): string[] => [
  RULE,
  ...wrapped(guidance, 96).map((line) => (line === "" ? "" : `    ${line}`)),
];

export interface RatchetSummary {
  readonly known: number;
  readonly stale: number;
}

export const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

export const errorsIn = (findings: readonly Finding[]): number =>
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
    `coverage  ${coverage.files} files · ${coverage.edges} edges · ${coverage.symbolEdges} symbol · ${coverage.namespaceEdges} namespace · ${coverage.externalEdges} external · ${coverage.builtinEdges} builtin · ${coverage.unresolvedImports} unresolved`,
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
  const lines = [
    `${claim.claim.padEnd(width)}${tallyOf(claim.findings)}`,
    ...listed(claim.findings, root, at),
  ];

  if (claim.findings.length === 0) return lines;

  return [...lines, ...said(claim.guidance), ""];
};

export const countsOf = (report: Report): readonly string[] => {
  const total = report.claims.flatMap((claim) => claim.findings);
  const errors = errorsIn(total);

  return [plural(report.claims.length, "claim"), plural(errors, "error"), plural(total.length - errors, "warning")];
};

const tallyLine = (report: Report): string => countsOf(report).join(" · ");

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
