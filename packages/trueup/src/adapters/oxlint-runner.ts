import type { Runner, RunnerFinding, RunnerOutcome } from "../ports/runner.ts";
import type { Severity } from "../ports/severity.ts";
import { absoluteIn, numberOf, objectOf, stringOf } from "./tool-output.ts";
import { jsonRunner, readToolJson, toolCallFrom } from "./tool-process.ts";

const CODE = /^([A-Za-z-]+)\(([^)]+)\)$/;
const REPORTING = new Set(["warn", "deny"]);

export interface OxlintRunnerOptions {
  readonly command?: readonly string[] | undefined;
  readonly paths?: readonly string[] | undefined;
  readonly categories?: readonly string[] | undefined;
  readonly write?: boolean | undefined;
}

interface Payload {
  readonly diagnostics: readonly unknown[];
  readonly files: number;
}

type Read =
  | { readonly kind: "read"; readonly payload: Payload }
  | { readonly kind: "failed"; readonly reason: string };

const categoryOf = (code: string): string => {
  const parts = CODE.exec(code);
  return parts === null ? code : `${parts[1]}/${parts[2]}`;
};

const severityOf = (raw: unknown): Severity => (stringOf(raw) === "warning" ? "warning" : "error");

const offsetOf = (raw: Record<string, unknown>): number | null => {
  const labels = raw.labels;
  if (!Array.isArray(labels)) return null;

  const span = objectOf(objectOf(labels[0])?.span);
  return span === null ? null : numberOf(span.offset);
};

const readPayload = (top: Record<string, unknown>): Read => {
  if (!Array.isArray(top.diagnostics)) {
    return { kind: "failed", reason: "output carried no diagnostics" };
  }

  const files = numberOf(top.number_of_files);
  if (files === null) return { kind: "failed", reason: "output did not say how many files it read" };
  if (files === 0) return { kind: "failed", reason: "it found no files to lint" };

  return { kind: "read", payload: { diagnostics: top.diagnostics, files } };
};

const findingOf = (entry: unknown, root: string): RunnerFinding | null => {
  const raw = objectOf(entry);
  if (raw === null) return null;

  const code = stringOf(raw.code);
  const message = stringOf(raw.message);
  if (code === null || message === null) return null;

  return {
    category: categoryOf(code),
    message,
    file: absoluteIn(root, stringOf(raw.filename)),
    start: offsetOf(raw),
    severity: severityOf(raw.severity),
  };
};

const covers = (entry: string, name: string): boolean => name === entry || name.startsWith(`${entry}/`);

const wanted = (categories: readonly string[], category: string): boolean =>
  categories.length === 0 || categories.some((entry) => covers(entry, category));

const stateOf = (raw: unknown): string | null => (Array.isArray(raw) ? stringOf(raw[0]) : stringOf(raw));

const enabledIn = async (command: readonly string[], root: string): Promise<readonly string[] | null> => {
  const resolved = await readToolJson({ command, args: ["--print-config"], cwd: root });
  if (resolved.kind === "failed") return null;

  const rules = objectOf(resolved.payload.rules);
  if (rules === null) return null;

  return Object.entries(rules)
    .filter(([, raw]) => REPORTING.has(stateOf(raw) ?? ""))
    .map(([rule]) => (rule.includes("/") ? rule : `eslint/${rule}`));
};

const unreportableIn = async (
  command: readonly string[],
  root: string,
  categories: readonly string[],
): Promise<readonly string[] | null> => {
  if (categories.length === 0) return [];

  const enabled = await enabledIn(command, root);
  return enabled === null ? null : categories.filter((entry) => !enabled.some((rule) => covers(entry, rule)));
};

export function oxlintRunner(options: OxlintRunnerOptions = {}): Runner {
  const { command, paths, fixing } = toolCallFrom(options, {
    command: ["npx", "--yes", "oxlint"],
    fix: ["--fix"],
  });
  const categories = options.categories ?? [];

  return jsonRunner({
    name: "oxlint",
    invoke: (root) => ({ command, args: [...fixing, "--format", "json", ...paths], cwd: root }),
    read: async (source, root): Promise<RunnerOutcome> => {
      const read = readPayload(source.payload);
      if (read.kind === "failed") return read;

      const unreportable = await unreportableIn(command, root, categories);
      if (unreportable === null) {
        return { kind: "failed", reason: "its resolved rule severities were unreadable" };
      }
      if (unreportable.length > 0) {
        return {
          kind: "failed",
          reason: `these categories rest on rules oxlint has not enabled, so they can never report: ${unreportable.join(", ")}. Turn them on in oxlint's own config, or drop them from the runner.`,
        };
      }

      const findings = read.payload.diagnostics
        .map((entry) => findingOf(entry, root))
        .filter((finding) => finding !== null)
        .filter((finding) => wanted(categories, finding.category));

      return { kind: "findings", findings };
    },
  });
}
