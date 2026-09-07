export type Severity = "error" | "warning";

export interface Finding {
  readonly severity: Severity;
  readonly message: string;
  readonly file: string | null;
  readonly start: number | null;
}

export interface ClaimResult {
  readonly claim: string;
  readonly findings: readonly Finding[];
}

export interface Coverage {
  readonly files: number;
  readonly edges: number;
  readonly symbolEdges: number;
  readonly externalEdges: number;
  readonly builtinEdges: number;
  readonly namespaceEdges: number;
  readonly unresolvedImports: number;
  readonly filesByZone: Readonly<Record<string, number>>;
  readonly unclassifiedFiles: number;
}

export interface Report {
  readonly claims: readonly ClaimResult[];
  readonly coverage: Coverage;
}

export const findingsOf = (report: Report): readonly Finding[] =>
  report.claims.flatMap((claim) => claim.findings);

export const countOf = (report: Report, severity: Severity): number =>
  findingsOf(report).filter((finding) => finding.severity === severity).length;
