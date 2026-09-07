import type { Runner, RunnerFinding, RunnerOutcome } from "../ports/runner.ts";
import type { Severity } from "../ports/severity.ts";
import { createOffsetReader, type OffsetOf } from "./source-offset.ts";
import { absoluteIn, numberOf, objectOf, stringOf, summarize } from "./tool-output.ts";
import { jsonRunner } from "./tool-process.ts";

export const DEFAULT_MAX_DIAGNOSTICS = 10_000;

const SHAPE = "output was not biome's summary and diagnostics";
const UNCHECKED = ["parse", "internalError/"];

const SEVERITIES: Readonly<Record<string, Severity>> = {
  fatal: "error",
  error: "error",
  warning: "warning",
  info: "warning",
  hint: "warning",
};

export interface BiomeRunnerOptions {
  readonly command?: readonly string[] | undefined;
  readonly paths?: readonly string[] | undefined;
  readonly categories?: readonly string[] | undefined;
  readonly maxDiagnostics?: number | undefined;
  readonly write?: boolean | undefined;
}

type Payload =
  | {
      readonly kind: "payload";
      readonly summary: Record<string, unknown>;
      readonly diagnostics: readonly unknown[];
    }
  | { readonly kind: "failed"; readonly reason: string };

type Converted =
  | { readonly kind: "finding"; readonly finding: RunnerFinding }
  | { readonly kind: "skip" }
  | { readonly kind: "failed"; readonly reason: string };

interface ConvertInput {
  readonly root: string;
  readonly offsetOf: OffsetOf;
  readonly categories: readonly string[] | undefined;
}

const wanted = (category: string, categories: readonly string[] | undefined): boolean =>
  categories === undefined ||
  categories.some((prefix) => category === prefix || category.startsWith(`${prefix}/`));

const readPayload = (report: Record<string, unknown>): Payload => {
  const summary = objectOf(report.summary);
  const { diagnostics } = report;
  if (summary === null || !Array.isArray(diagnostics)) return { kind: "failed", reason: SHAPE };

  return { kind: "payload", summary, diagnostics };
};

interface Attempt {
  readonly paths: readonly string[];
  readonly stderr: string;
  readonly maxDiagnostics: number;
}

const unusable = (
  summary: Record<string, unknown>,
  { paths, stderr, maxDiagnostics }: Attempt,
): string | null => {
  const changed = numberOf(summary.changed);
  const unchanged = numberOf(summary.unchanged);
  if (changed === null || unchanged === null) return SHAPE;
  if (changed + unchanged === 0) return `processed no files under ${paths.join(" ")}: ${summarize(stderr)}`;

  const withheld = numberOf(summary.diagnosticsNotPrinted) ?? 0;
  return withheld > 0
    ? `biome withheld ${withheld} diagnostics; raise maxDiagnostics above ${maxDiagnostics}`
    : null;
};

const startOf = (
  location: Record<string, unknown> | null,
  path: string | null,
  offsetOf: OffsetOf,
): number | null => {
  const start = location === null ? null : objectOf(location.start);
  const line = start === null ? null : numberOf(start.line);
  const column = (start === null ? null : numberOf(start.column)) ?? 1;
  return path === null || line === null ? null : offsetOf(path, line, column - 1);
};

const convert = (entry: unknown, { root, offsetOf, categories }: ConvertInput): Converted => {
  const raw = objectOf(entry);
  const category = raw === null ? null : stringOf(raw.category);
  if (raw === null || category === null) return { kind: "failed", reason: SHAPE };

  const location = objectOf(raw.location);
  const path = absoluteIn(root, location === null ? null : stringOf(location.path));

  if (UNCHECKED.some((prefix) => category.startsWith(prefix))) {
    return { kind: "failed", reason: `${path ?? "a file"} was not checked: ${summarize(raw.message)}` };
  }

  const severity = SEVERITIES[stringOf(raw.severity) ?? ""];
  if (severity === undefined) {
    return {
      kind: "failed",
      reason: `biome reported an unrecognised severity ${JSON.stringify(raw.severity)}`,
    };
  }

  if (!wanted(category, categories)) return { kind: "skip" };

  const message = summarize(raw.message);
  return {
    kind: "finding",
    finding: {
      category,
      message: message === "" ? category : message,
      file: path,
      start: startOf(location, path, offsetOf),
      severity,
    },
  };
};

const collect = (diagnostics: readonly unknown[], context: ConvertInput): RunnerOutcome => {
  const findings: RunnerFinding[] = [];

  for (const entry of diagnostics) {
    const converted = convert(entry, context);
    if (converted.kind === "failed") return converted;
    if (converted.kind === "finding") findings.push(converted.finding);
  }

  return { kind: "findings", findings };
};

export function biomeRunner(options: BiomeRunnerOptions = {}): Runner {
  const command = options.command ?? ["npx", "--yes", "@biomejs/biome", "lint"];
  const paths = options.paths ?? ["."];
  const categories = options.categories;
  const maxDiagnostics = options.maxDiagnostics ?? DEFAULT_MAX_DIAGNOSTICS;
  const fixing = options.write === true ? ["--write"] : [];

  return jsonRunner({
    name: "biome",
    invoke: (root) => ({
      command,
      args: [...fixing, "--reporter=json", `--max-diagnostics=${maxDiagnostics}`, ...paths],
      cwd: root,
    }),
    read: (source, root): RunnerOutcome => {
      const payload = readPayload(source.payload);
      if (payload.kind === "failed") return payload;

      const reason = unusable(payload.summary, { paths, stderr: source.stderr, maxDiagnostics });
      if (reason !== null) return { kind: "failed", reason };

      return collect(payload.diagnostics, { root, offsetOf: createOffsetReader(root), categories });
    },
  });
}
