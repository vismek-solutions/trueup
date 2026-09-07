import { readFileSync } from "node:fs";
import { relative } from "node:path";
import type { Finding, Report } from "../report/model.ts";

const positionOf = (file: string, offset: number, cache: Map<string, string>): string => {
  let text = cache.get(file);
  if (text === undefined) {
    try {
      text = readFileSync(file, "utf8");
    } catch {
      text = "";
    }
    cache.set(file, text);
  }
  if (text === "") return "";
  const upTo = text.slice(0, offset);
  const line = upTo.split("\n").length;
  const column = offset - (upTo.lastIndexOf("\n") + 1) + 1;
  return `:${line}:${column}`;
};

const locate = (root: string, finding: Finding, cache: Map<string, string>): string => {
  if (finding.file === null) return "";
  const position = finding.start === null ? "" : positionOf(finding.file, finding.start, cache);
  return `${relative(root, finding.file)}${position}`;
};

const wrap = (text: string, width: number): string[] => {
  const lines: string[] = [];

  for (const word of text.split(" ")) {
    const last = lines[lines.length - 1];
    if (last === undefined || `${last} ${word}`.length > width) lines.push(word);
    else lines[lines.length - 1] = `${last} ${word}`;
  }

  return lines;
};

export interface RatchetSummary {
  readonly known: number;
  readonly stale: number;
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

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
    "",
  ];
};

interface ClaimLinesInput {
  readonly root: string;
  readonly width: number;
  readonly cache: Map<string, string>;
}

const claimLines = (claim: Report["claims"][number], { root, width, cache }: ClaimLinesInput): string[] => {
  const lines = [`${claim.claim.padEnd(width)}${tallyOf(claim.findings)}`];

  for (const finding of claim.findings) {
    const where = locate(root, finding, cache);
    lines.push(where === "" ? `    ${finding.message}` : `    ${where}  ${finding.message}`);
  }

  if (claim.findings.length === 0) return lines;

  return [...lines, ...wrap(claim.guidance, 96).map((line) => `    ${line}`), ""];
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

const problemsIn = (report: Report): Problem[] => {
  const byKey = new Map<string, Problem>();

  for (const claim of report.claims) {
    for (const finding of claim.findings.filter((entry) => entry.severity === "error")) {
      const key = keyOf(claim.claim, finding);
      const found = byKey.get(key);
      if (found === undefined) byKey.set(key, { claim, findings: [finding] });
      else byKey.set(key, { claim, findings: [...found.findings, finding] });
    }
  }

  return [...byKey.values()];
};

export function renderNext(report: Report, root: string, ratchet?: RatchetSummary): string {
  const problems = problemsIn(report);
  const first = problems[0];
  const tally = tallyLine(report);

  if (first === undefined) {
    return [
      `nothing left to fix · ${tally}`,
      ...(ratchet === undefined || ratchet.stale === 0 ? [] : [`baseline  ${ratchet.stale} stale`]),
    ].join("\n");
  }

  const cache = new Map<string, string>();
  const shown = first.findings.map((finding) => {
    const where = locate(root, finding, cache);
    return where === "" ? `    ${finding.message}` : `    ${where}  ${finding.message}`;
  });

  return [
    `problem 1 of ${problems.length} · ${tally}`,
    "",
    `${first.claim.claim}  ${plural(first.findings.length, "error")}`,
    ...shown,
    ...wrap(first.claim.guidance, 96).map((line) => `    ${line}`),
  ].join("\n");
}

export function renderDots(report: Report, root: string, ratchet?: RatchetSummary): string {
  const cache = new Map<string, string>();
  const { coverage } = report;
  const failed = report.claims.filter((claim) => errorsIn(claim.findings) > 0);
  const width = Math.max(44, ...failed.map((claim) => claim.claim.length + 2));

  const detail = failed.flatMap((claim) => {
    const hits = claim.findings.filter((finding) => finding.severity === "error");
    const shown = hits.map((finding) => {
      const where = locate(root, finding, cache);
      return where === "" ? `    ${finding.message}` : `    ${where}  ${finding.message}`;
    });

    return [
      "",
      `${claim.claim.padEnd(width)}${plural(hits.length, "error")}`,
      ...shown,
      ...wrap(claim.guidance, 96).map((line) => `    ${line}`),
    ];
  });

  return [
    `${report.claims.map((claim) => markOf(claim.findings)).join("")}  ${coverage.files} files · ${coverage.edges} edges · ${coverage.unresolvedImports} unresolved`,
    ...(ratchet === undefined ? [] : [`baseline  ${ratchet.known} known · ${ratchet.stale} stale`]),
    ...detail,
    "",
    tallyLine(report),
  ].join("\n");
}

export function render(report: Report, root: string, ratchet?: RatchetSummary): string {
  const input: ClaimLinesInput = {
    root,
    width: Math.max(44, ...report.claims.map((claim) => claim.claim.length + 2)),
    cache: new Map<string, string>(),
  };

  return [
    ...headerOf(report, ratchet),
    ...report.claims.flatMap((claim) => claimLines(claim, input)),
    "",
    tallyLine(report),
  ].join("\n");
}
