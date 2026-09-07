import type { Runner, RunnerFinding, RunnerOutcome } from "../ports/runner.ts";
import type { Severity } from "../ports/severity.ts";
import { createOffsetReader, type OffsetOf } from "./source-offset.ts";
import { absoluteIn, numberOf, stringOf } from "./tool-output.ts";
import { captureTool } from "./tool-process.ts";

export const FALLOW_CHECK_SCHEMA = 9;

export const DEFAULT_FALLOW_CATEGORIES = [
  "unused_files",
  "unused_exports",
  "unused_types",
  "unused_dependencies",
  "duplicate_exports",
  "circular_dependencies",
] as const;

export interface FallowRunnerOptions {
  readonly command?: readonly string[] | undefined;
  readonly categories?: readonly string[] | undefined;
  readonly severity?: Severity | undefined;
}

interface RawFinding {
  readonly path?: unknown;
  readonly line?: unknown;
  readonly col?: unknown;
  readonly export_name?: unknown;
  readonly name?: unknown;
  readonly cycle?: unknown;
}

type Check =
  | { readonly kind: "check"; readonly check: Record<string, unknown> }
  | { readonly kind: "failed"; readonly reason: string };

interface FindingInput {
  readonly root: string;
  readonly offsetOf: OffsetOf;
  readonly severity: Severity;
}

const describe = (category: string, raw: RawFinding): string => {
  const cycle = Array.isArray(raw.cycle) ? raw.cycle.join(" -> ") : null;
  const subject = stringOf(raw.export_name) ?? stringOf(raw.name) ?? cycle ?? stringOf(raw.path) ?? "";
  const what = category.replaceAll("_", " ");
  return subject === "" ? what : `${what}: ${subject}`;
};

const readCheck = (stdout: string): Check => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { kind: "failed", reason: "output was not JSON" };
  }

  const check = (parsed as { check?: unknown }).check;
  if (check === undefined || check === null || typeof check !== "object") {
    return { kind: "failed", reason: "output carried no check section" };
  }

  const schema = (check as { schema_version?: unknown }).schema_version;
  if (schema !== FALLOW_CHECK_SCHEMA) {
    return {
      kind: "failed",
      reason: `check schema ${String(schema)} is not the expected ${FALLOW_CHECK_SCHEMA}`,
    };
  }

  return { kind: "check", check: check as Record<string, unknown> };
};

const findingOf = (
  category: string,
  raw: RawFinding,
  { root, offsetOf, severity }: FindingInput,
): RunnerFinding => {
  const path = absoluteIn(root, stringOf(raw.path));
  const line = numberOf(raw.line);
  const column = numberOf(raw.col) ?? 0;

  return {
    category,
    message: describe(category, raw),
    file: path,
    start: path === null || line === null ? null : offsetOf(path, line, column),
    severity,
  };
};

const findingsIn = (
  check: Record<string, unknown>,
  category: string,
  input: FindingInput,
): readonly RunnerFinding[] => {
  const entries = check[category];
  return Array.isArray(entries)
    ? entries.map((entry) => findingOf(category, entry as RawFinding, input))
    : [];
};

export function fallowRunner(options: FallowRunnerOptions = {}): Runner {
  const command = options.command ?? ["npx", "--yes", "fallow@latest"];
  const categories = options.categories ?? [...DEFAULT_FALLOW_CATEGORIES];
  const severity = options.severity ?? "error";

  return {
    name: "fallow",
    run: (root): RunnerOutcome => {
      const captured = captureTool({ command, args: ["--root", root, "--format", "json", "--quiet"] });
      if (captured.kind === "failed") return captured;
      if (captured.stdout.trim() === "") {
        return { kind: "failed", reason: `no output (exit ${captured.status})` };
      }

      const check = readCheck(captured.stdout);
      if (check.kind === "failed") return check;

      const input: FindingInput = { root, offsetOf: createOffsetReader(root), severity };
      return {
        kind: "findings",
        findings: categories.flatMap((category) => findingsIn(check.check, category, input)),
      };
    },
  };
}
