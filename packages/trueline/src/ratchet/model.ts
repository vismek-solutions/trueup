import type { Report } from "../report/model.ts";

export interface RatchetResult {
  readonly report: Report;
  readonly known: number;
  readonly stale: number;
}
