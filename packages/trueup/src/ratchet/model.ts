import type { BaselineEntry } from "../ports/baseline.ts";
import type { Report } from "../report/model.ts";

export interface RatchetResult {
  readonly report: Report;
  readonly known: number;
  readonly stale: number;
}

export interface Acceptance {
  readonly added: readonly BaselineEntry[];
  readonly retired: readonly BaselineEntry[];
  readonly first: boolean;
}
