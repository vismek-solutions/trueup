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

const wrap = (text: string, width: number): string[] =>
  text.split(" ").reduce<string[]>((lines, word) => {
    const last = lines[lines.length - 1];
    if (last === undefined || `${last} ${word}`.length > width) return [...lines, word];
    lines[lines.length - 1] = `${last} ${word}`;
    return lines;
  }, []);

export interface RatchetSummary {
  readonly known: number;
  readonly stale: number;
}

export function render(report: Report, root: string, ratchet?: RatchetSummary): string {
  const cache = new Map<string, string>();
  const lines: string[] = [];
  const { coverage } = report;

  const zones = Object.entries(coverage.filesByZone)
    .map(([name, count]) => `${name} ${count}`)
    .join(" · ");

  lines.push(
    `coverage  ${coverage.files} files · ${coverage.edges} edges · ${coverage.symbolEdges} symbol · ${coverage.externalEdges} external · ${coverage.builtinEdges} builtin · ${coverage.unresolvedImports} unresolved`,
  );
  lines.push(`zones     ${zones || "none"} · ${coverage.unclassifiedFiles} unclassified`);
  if (ratchet !== undefined) {
    lines.push(`baseline  ${ratchet.known} known · ${ratchet.stale} stale`);
  }
  lines.push("");

  for (const claim of report.claims) {
    const errors = claim.findings.filter((finding) => finding.severity === "error").length;
    const warnings = claim.findings.length - errors;
    const tally =
      claim.findings.length === 0
        ? "ok"
        : [errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : "", warnings > 0 ? `${warnings} warning${warnings === 1 ? "" : "s"}` : ""]
            .filter(Boolean)
            .join(" · ");

    lines.push(`${claim.claim.padEnd(44)}${tally}`);
    for (const finding of claim.findings) {
      const where = locate(root, finding, cache);
      lines.push(where === "" ? `    ${finding.message}` : `    ${where}  ${finding.message}`);
    }
    if (claim.findings.length > 0) {
      for (const line of wrap(claim.guidance, 96)) lines.push(`    ${line}`);
      lines.push("");
    }
  }

  const total = report.claims.flatMap((claim) => claim.findings);
  const errors = total.filter((finding) => finding.severity === "error").length;
  const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;
  lines.push("");
  lines.push(
    [plural(report.claims.length, "claim"), plural(errors, "error"), plural(total.length - errors, "warning")].join(
      " · ",
    ),
  );

  return lines.join("\n");
}
