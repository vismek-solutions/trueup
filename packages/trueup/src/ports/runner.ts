import type { Severity } from "./severity.ts";

export interface RunnerFinding {
  readonly category: string;
  readonly message: string;
  readonly file: string | null;
  readonly start: number | null;
  readonly severity: Severity;
  readonly group?: string | undefined;
}

export type RunnerOutcome =
  | { readonly kind: "findings"; readonly findings: readonly RunnerFinding[] }
  | { readonly kind: "failed"; readonly reason: string };

export interface Runner {
  readonly name: string;
  readonly run: (root: string) => RunnerOutcome;
}
