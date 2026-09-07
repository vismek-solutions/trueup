import type { Runner, RunnerFinding, RunnerOutcome } from "../ports/runner.ts";
import type { Severity } from "../ports/severity.ts";
import { createOffsetReader, type OffsetOf } from "./source-offset.ts";
import { absoluteIn, numberOf, objectOf, stringOf } from "./tool-output.ts";
import { jsonRunner } from "./tool-process.ts";

const FALLOW_CHECK_SCHEMA = 9;

export const DEFAULT_FALLOW_CATEGORIES = [
  "unused_files",
  "unused_exports",
  "unused_types",
  "unused_dependencies",
  "duplicate_exports",
  "circular_dependencies",
] as const;

export type DuplicationMode = "strict" | "mild" | "weak" | "semantic";

export interface FallowDuplicationOptions {
  readonly mode?: DuplicationMode | undefined;
  readonly minLines?: number | undefined;
  readonly minTokens?: number | undefined;
}

export interface FallowRunnerOptions {
  readonly command?: readonly string[] | undefined;
  readonly categories?: readonly string[] | undefined;
  readonly duplication?: FallowDuplicationOptions | undefined;
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

interface RawInstance {
  readonly file?: unknown;
  readonly start_line?: unknown;
  readonly start_col?: unknown;
}

interface RawGroup {
  readonly instances?: unknown;
  readonly line_count?: unknown;
  readonly fingerprint?: unknown;
}

type Payload =
  | { readonly kind: "payload"; readonly check: Record<string, unknown>; readonly dupes: unknown }
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

const readPayload = (report: Record<string, unknown>): Payload => {
  const check = objectOf(report.check);
  if (check === null) return { kind: "failed", reason: "output carried no check section" };

  const schema = (check as { schema_version?: unknown }).schema_version;
  if (schema !== FALLOW_CHECK_SCHEMA) {
    return {
      kind: "failed",
      reason: `check schema ${String(schema)} is not the expected ${FALLOW_CHECK_SCHEMA}`,
    };
  }

  return { kind: "payload", check, dupes: report.dupes };
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

const DUPLICATION_CATEGORY = "code_duplication";

const placeOf = (raw: RawInstance): string | null => {
  const file = stringOf(raw.file);
  const line = numberOf(raw.start_line);
  return file === null || line === null ? null : `${file}:${line}`;
};

const cloneFindings = (group: RawGroup, input: FindingInput): readonly RunnerFinding[] => {
  const instances: readonly RawInstance[] = Array.isArray(group.instances) ? group.instances : [];
  const places = instances.map(placeOf);
  const lines = numberOf(group.line_count) ?? 0;
  const fingerprint = stringOf(group.fingerprint) ?? places.join("|");

  return instances.flatMap((instance, at) => {
    const path = absoluteIn(input.root, stringOf(instance.file));
    const line = numberOf(instance.start_line);
    if (path === null || line === null) return [];

    const elsewhere = places.filter((place, other) => other !== at && place !== null);
    return [
      {
        category: DUPLICATION_CATEGORY,
        message: `${lines} lines written the same way at ${elsewhere.join(" · ")}`,
        file: path,
        start: input.offsetOf(path, line, numberOf(instance.start_col) ?? 0),
        severity: input.severity,
        group: fingerprint,
      },
    ];
  });
};

const clonesIn = (dupes: unknown, input: FindingInput): readonly RunnerFinding[] | null => {
  if (dupes === undefined || dupes === null || typeof dupes !== "object") return null;

  const groups = (dupes as { clone_groups?: unknown }).clone_groups;
  return Array.isArray(groups) ? groups.flatMap((group) => cloneFindings(group as RawGroup, input)) : null;
};

const duplicationArgs = ({ mode, minLines, minTokens }: FallowDuplicationOptions): string[] => [
  ...(mode === undefined ? [] : ["--dupes-mode", mode]),
  ...(minLines === undefined ? [] : ["--dupes-min-lines", String(minLines)]),
  ...(minTokens === undefined ? [] : ["--dupes-min-tokens", String(minTokens)]),
];

export function fallowRunner(options: FallowRunnerOptions = {}): Runner {
  const command = options.command ?? ["npx", "--yes", "fallow@latest"];
  const categories = options.categories ?? [...DEFAULT_FALLOW_CATEGORIES];
  const severity = options.severity ?? "error";
  const duplication = options.duplication;
  const extra = duplication === undefined ? [] : duplicationArgs(duplication);

  return jsonRunner({
    name: "fallow",
    invoke: (root) => ({ command, args: ["--root", root, "--format", "json", "--quiet", ...extra] }),
    read: (source, root): RunnerOutcome => {
      const payload = readPayload(source.payload);
      if (payload.kind === "failed") return payload;

      const input: FindingInput = { root, offsetOf: createOffsetReader(root), severity };
      const found = categories.flatMap((category) => findingsIn(payload.check, category, input));
      if (duplication === undefined) return { kind: "findings", findings: found };

      const clones = clonesIn(payload.dupes, input);
      if (clones === null) return { kind: "failed", reason: "output carried no clone groups" };
      return { kind: "findings", findings: [...found, ...clones] };
    },
  });
}
