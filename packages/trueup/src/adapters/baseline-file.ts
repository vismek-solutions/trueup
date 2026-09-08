import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Baseline, BaselineEntry } from "../ports/baseline.ts";

const EMPTY_BASELINE: Baseline = { entries: [] };

const BASELINE_NAME = "trueup.baseline.json";

export const baselinePathIn = (root: string): string => join(root, BASELINE_NAME);

const isEntry = (value: unknown): value is BaselineEntry => {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.claim === "string" &&
    typeof candidate.message === "string" &&
    (candidate.file === null || typeof candidate.file === "string")
  );
};

export function readBaseline(path: string): Baseline {
  if (!existsSync(path)) return EMPTY_BASELINE;

  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const entries = (parsed as { entries?: unknown }).entries;
  if (!Array.isArray(entries) || !entries.every(isEntry)) {
    throw new Error(`${path} is not a baseline file`);
  }

  return { entries };
}

export const writeBaseline = (path: string, baseline: Baseline): void =>
  writeFileSync(path, `${JSON.stringify(baseline, null, 2)}\n`);
