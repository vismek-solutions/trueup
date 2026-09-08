import { createHash } from "node:crypto";
import { relative, sep } from "node:path";
import type { Report } from "../report/model.ts";
import { locator } from "./position.ts";

interface CodeQualityIssue {
  readonly description: string;
  readonly check_name: string;
  readonly fingerprint: string;
  readonly severity: "major" | "minor";
  readonly location: { readonly path: string; readonly lines: { readonly begin: number } };
}

const posix = (path: string): string => (sep === "/" ? path : path.split(sep).join("/"));

const fingerprintOf = (claim: string, path: string, message: string): string =>
  createHash("sha256").update(`${claim}\0${path}\0${message}`).digest("hex");

export function renderGitlab(report: Report, root: string, rulebook: string): string {
  const at = locator();

  const issues = report.claims.flatMap((claim) =>
    claim.findings.map((finding): CodeQualityIssue => {
      const path = posix(relative(root, finding.file ?? rulebook));
      const position = at(finding.file, finding.start);

      return {
        description: `${finding.message} — ${claim.guidance}`,
        check_name: claim.claim,
        fingerprint: fingerprintOf(claim.claim, path, finding.message),
        severity: finding.severity === "error" ? "major" : "minor",
        location: { path, lines: { begin: position?.line ?? 1 } },
      };
    }),
  );

  return JSON.stringify(issues, null, 2);
}
