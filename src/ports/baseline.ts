export interface BaselineEntry {
  readonly claim: string;
  readonly file: string | null;
  readonly message: string;
}

export interface Baseline {
  readonly entries: readonly BaselineEntry[];
}

export const EMPTY_BASELINE: Baseline = { entries: [] };
