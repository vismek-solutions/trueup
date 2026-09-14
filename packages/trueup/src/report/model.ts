import type { Severity } from "../ports/severity.ts";

export type { Severity };

export interface Finding {
  readonly severity: Severity;
  readonly message: string;
  readonly file: string | null;
  readonly start: number | null;
  readonly group?: string | undefined;
  readonly accepted?: boolean | undefined;
  readonly reworded?: boolean | undefined;
  readonly symbols?: readonly string[] | undefined;
  readonly specifier?: string | undefined;
}

export interface ClaimResult {
  readonly claim: string;
  readonly setting?: string | undefined;
  readonly guidance: string;
  readonly onePerFile?: boolean | undefined;
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
  readonly notices?: readonly string[] | undefined;
}

const identityOf = (finding: Finding): string =>
  `${finding.file ?? ""}\0${finding.start ?? ""}\0${finding.message}`;

export const withoutDuplicates = (claims: readonly ClaimResult[]): readonly ClaimResult[] =>
  claims.map((claim) => {
    const unique = new Map(claim.findings.map((finding) => [identityOf(finding), finding]));
    return unique.size === claim.findings.length ? claim : { ...claim, findings: [...unique.values()] };
  });

const findingsOf = (report: Report): readonly Finding[] => report.claims.flatMap((claim) => claim.findings);

export const countOf = (report: Report, severity: Severity): number =>
  findingsOf(report).filter((finding) => finding.severity === severity).length;
