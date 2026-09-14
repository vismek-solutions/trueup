import { createHash } from "node:crypto";
import { relative } from "node:path";
import { toPosix } from "../../paths/posix.ts";
import type { Report, Severity } from "../../report/model.ts";
import { locator } from "../position.ts";

export interface PlacedFinding {
  readonly claim: string;
  readonly guidance: string;
  readonly severity: Severity;
  readonly message: string;
  readonly path: string;
  readonly line: number;
  readonly column: number | null;
  readonly fingerprint: string;
}

const fingerprintOf = (claim: string, path: string, message: string): string =>
  createHash("sha256").update(`${claim}\0${path}\0${message}`).digest("hex");

export function placedIn(report: Report, root: string, rulebook: string): readonly PlacedFinding[] {
  const at = locator();

  return report.claims.flatMap((claim) =>
    claim.findings.map((finding): PlacedFinding => {
      const path = toPosix(relative(root, finding.file ?? rulebook));
      const position = at(finding.file, finding.start);

      return {
        claim: claim.claim,
        guidance: claim.guidance,
        severity: finding.severity,
        message: finding.message,
        path,
        line: position?.line ?? 1,
        column: position?.column ?? null,
        fingerprint: fingerprintOf(claim.claim, path, finding.message),
      };
    }),
  );
}
