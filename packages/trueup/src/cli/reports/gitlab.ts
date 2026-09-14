import type { Report } from "../../report/model.ts";
import { placedIn } from "./placed.ts";

interface CodeQualityIssue {
  readonly description: string;
  readonly check_name: string;
  readonly fingerprint: string;
  readonly severity: "major" | "minor";
  readonly location: { readonly path: string; readonly lines: { readonly begin: number } };
}

export function renderGitlab(report: Report, root: string, rulebook: string): string {
  const issues = placedIn(report, root, rulebook).map(
    (finding): CodeQualityIssue => ({
      description: `${finding.message} — ${finding.guidance}`,
      check_name: finding.claim,
      fingerprint: finding.fingerprint,
      severity: finding.severity === "error" ? "major" : "minor",
      location: { path: finding.path, lines: { begin: finding.line } },
    }),
  );

  return JSON.stringify(issues, null, 2);
}
