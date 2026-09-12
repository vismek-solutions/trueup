import type { Runner, RunnerFinding, RunnerOutcome } from "../ports/runner.ts";
import { createOffsetReader, type OffsetOf } from "./source-offset.ts";
import { summarize } from "./tool-output.ts";
import { awaitTool } from "./tool-process.ts";

const CONFIGURATION_ERROR = 2;
const WARNING_SEVERITY = 1;
const UNATTRIBUTED = "unattributed";
const SUPPRESSED = "suppressed";
const SHAPE = "output was not eslint's array of file results";
const NO_SUPPRESSIONS = "this eslint does not report suppressed messages";

export interface EslintRunnerOptions {
  readonly command?: readonly string[] | undefined;
  readonly patterns?: readonly string[] | undefined;
  readonly categories?: readonly string[] | undefined;
  readonly reportSuppressed?: boolean | undefined;
}

interface RawSuppression {
  readonly justification?: unknown;
}

interface RawMessage {
  readonly ruleId?: unknown;
  readonly severity?: unknown;
  readonly message?: unknown;
  readonly line?: unknown;
  readonly column?: unknown;
  readonly fatal?: unknown;
  readonly suppressions?: unknown;
}

interface RawResult {
  readonly filePath?: unknown;
  readonly messages?: unknown;
  readonly suppressedMessages?: unknown;
}

type Results =
  | { readonly kind: "results"; readonly results: readonly RawResult[] }
  | { readonly kind: "failed"; readonly reason: string };

interface CollectInput {
  readonly offsetOf: OffsetOf;
  readonly categories: readonly string[] | undefined;
  readonly reportSuppressed: boolean;
}

const ruleIdOf = (raw: RawMessage): string => (typeof raw.ruleId === "string" ? raw.ruleId : UNATTRIBUTED);

const messageOf = (raw: RawMessage): string =>
  typeof raw.message === "string" ? raw.message : ruleIdOf(raw);

const justificationOf = (raw: RawMessage): string => {
  if (!Array.isArray(raw.suppressions)) return "";
  return (raw.suppressions as readonly RawSuppression[])
    .map((suppression) =>
      typeof suppression.justification === "string" ? suppression.justification.trim() : "",
    )
    .filter((reason) => reason !== "")
    .join("; ");
};

const suppressedMessageOf = (raw: RawMessage): string => {
  const justification = justificationOf(raw);
  return justification === "" ? messageOf(raw) : `${messageOf(raw)} suppressed because: ${justification}`;
};

interface Located {
  readonly file: string;
  readonly category: string;
  readonly offsetOf: OffsetOf;
}

const findingOf = (
  raw: RawMessage,
  message: string,
  { file, category, offsetOf }: Located,
): RunnerFinding => {
  const line = typeof raw.line === "number" ? raw.line : null;
  const column = typeof raw.column === "number" ? raw.column : 1;

  return {
    category,
    message,
    file,
    start: line === null ? null : offsetOf(file, line, column - 1),
    severity: raw.severity === WARNING_SEVERITY ? "warning" : "error",
  };
};

const readResults = (stdout: string, patterns: readonly string[]): Results => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { kind: "failed", reason: "output was not JSON" };
  }

  if (!Array.isArray(parsed)) return { kind: "failed", reason: SHAPE };
  if (parsed.length === 0) return { kind: "failed", reason: `linted no files under ${patterns.join(" ")}` };

  return { kind: "results", results: parsed as readonly RawResult[] };
};

const keeps = (categories: readonly string[] | undefined, category: string): boolean =>
  categories === undefined || categories.includes(category);

const fromMessages = (messages: readonly RawMessage[], file: string, input: CollectInput): RunnerOutcome => {
  const findings: RunnerFinding[] = [];

  for (const raw of messages) {
    if (raw.fatal === true) {
      return { kind: "failed", reason: `${file} could not be parsed: ${summarize(raw.message)}` };
    }

    const category = ruleIdOf(raw);
    if (keeps(input.categories, category)) {
      findings.push(findingOf(raw, messageOf(raw), { file, category, offsetOf: input.offsetOf }));
    }
  }

  return { kind: "findings", findings };
};

const fromSuppressed = (
  suppressed: readonly RawMessage[],
  file: string,
  input: CollectInput,
): readonly RunnerFinding[] =>
  suppressed
    .map((raw) => ({ raw, category: `${SUPPRESSED}/${ruleIdOf(raw)}` }))
    .filter(({ category }) => keeps(input.categories, category))
    .map(({ raw, category }) =>
      findingOf(raw, suppressedMessageOf(raw), { file, category, offsetOf: input.offsetOf }),
    );

const fromResult = (entry: RawResult, input: CollectInput): RunnerOutcome => {
  const file = typeof entry.filePath === "string" ? entry.filePath : null;
  if (file === null || !Array.isArray(entry.messages)) return { kind: "failed", reason: SHAPE };

  const reported = fromMessages(entry.messages as readonly RawMessage[], file, input);
  if (reported.kind === "failed" || !input.reportSuppressed) return reported;

  if (!Array.isArray(entry.suppressedMessages)) return { kind: "failed", reason: NO_SUPPRESSIONS };

  return {
    kind: "findings",
    findings: [
      ...reported.findings,
      ...fromSuppressed(entry.suppressedMessages as readonly RawMessage[], file, input),
    ],
  };
};

const collect = (results: readonly RawResult[], input: CollectInput): RunnerOutcome => {
  const findings: RunnerFinding[] = [];

  for (const entry of results) {
    const collected = fromResult(entry, input);
    if (collected.kind === "failed") return collected;
    findings.push(...collected.findings);
  }

  return { kind: "findings", findings };
};

export function eslintRunner(options: EslintRunnerOptions = {}): Runner {
  const command = options.command ?? ["npx", "--yes", "eslint"];
  const patterns = options.patterns ?? ["."];
  const categories = options.categories;
  const reportSuppressed = options.reportSuppressed ?? false;

  return {
    name: "eslint",
    run: async (root): Promise<RunnerOutcome> => {
      const captured = await awaitTool({ command, args: [...patterns, "--format", "json"], cwd: root });
      if (captured.kind === "failed") return captured;
      if (captured.status >= CONFIGURATION_ERROR) {
        return { kind: "failed", reason: `exit ${captured.status}: ${summarize(captured.stderr)}` };
      }
      if (captured.stdout.trim() === "") {
        return { kind: "failed", reason: `no output (exit ${captured.status})` };
      }

      const results = readResults(captured.stdout, patterns);
      if (results.kind === "failed") return results;

      return collect(results.results, {
        offsetOf: createOffsetReader(root),
        categories,
        reportSuppressed,
      });
    },
  };
}
