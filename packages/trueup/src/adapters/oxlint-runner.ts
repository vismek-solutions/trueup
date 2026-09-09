import type { Runner, RunnerFinding, RunnerOutcome } from "../ports/runner.ts";
import type { Severity } from "../ports/severity.ts";
import { absoluteIn, numberOf, objectOf, stringOf } from "./tool-output.ts";
import { jsonRunner, toolCallFrom } from "./tool-process.ts";

const CODE = /^([A-Za-z-]+)\(([^)]+)\)$/;

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

const wanted = (categories: readonly string[], category: string): boolean =>
  categories.length === 0 ||
  categories.some((entry) => category === entry || category.startsWith(`${entry}/`));

export function oxlintRunner(options: OxlintRunnerOptions = {}): Runner {
  const { command, paths, fixing } = toolCallFrom(options, {
    command: ["npx", "--yes", "oxlint"],
    fix: ["--fix"],
  });
  const categories = options.categories ?? [];

  return jsonRunner({
    name: "oxlint",
    invoke: (root) => ({ command, args: [...fixing, "--format", "json", ...paths], cwd: root }),
    read: (source, root): RunnerOutcome => {
      const read = readPayload(source.payload);
      if (read.kind === "failed") return read;

      const findings = read.payload.diagnostics
        .map((entry) => findingOf(entry, root))
        .filter((finding) => finding !== null)
        .filter((finding) => wanted(categories, finding.category));

      return { kind: "findings", findings };
    },
  });
}
