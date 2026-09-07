import { spawnSync } from "node:child_process";
import type { Runner, RunnerFinding, RunnerOutcome } from "../ports/runner.ts";
import { createOffsetReader } from "./source-offset.ts";

const CONFIGURATION_ERROR = 2;
const WARNING_SEVERITY = 1;
const UNATTRIBUTED = "unattributed";
const SHAPE = "output was not eslint's array of file results";
const REASON_LIMIT = 300;

export interface EslintRunnerOptions {
  readonly command?: readonly string[] | undefined;
  readonly patterns?: readonly string[] | undefined;
  readonly categories?: readonly string[] | undefined;
}

interface RawMessage {
  readonly ruleId?: unknown;
  readonly severity?: unknown;
  readonly message?: unknown;
  readonly line?: unknown;
  readonly column?: unknown;
  readonly fatal?: unknown;
}

interface RawResult {
  readonly filePath?: unknown;
  readonly messages?: unknown;
}

const summarize = (text: unknown): string => {
  if (typeof text !== "string") return "";
  const collapsed = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join(" ");
  return collapsed.length > REASON_LIMIT ? `${collapsed.slice(0, REASON_LIMIT)}…` : collapsed;
};

export function eslintRunner(options: EslintRunnerOptions = {}): Runner {
  const command = options.command ?? ["npx", "--yes", "eslint"];
  const patterns = options.patterns ?? ["."];
  const categories = options.categories;

  return {
    name: "eslint",
    run: (root): RunnerOutcome => {
      const [executable, ...rest] = command;
      if (executable === undefined) return { kind: "failed", reason: "no command configured" };

      const result = spawnSync(executable, [...rest, ...patterns, "--format", "json"], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });

      if (result.error !== undefined) return { kind: "failed", reason: result.error.message };
      if (result.status === null) return { kind: "failed", reason: "the process was killed before it finished" };
      if (result.status >= CONFIGURATION_ERROR) {
        return { kind: "failed", reason: `exit ${result.status}: ${summarize(result.stderr)}` };
      }
      if (typeof result.stdout !== "string" || result.stdout.trim() === "") {
        return { kind: "failed", reason: `no output (exit ${result.status})` };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return { kind: "failed", reason: "output was not JSON" };
      }

      if (!Array.isArray(parsed)) return { kind: "failed", reason: SHAPE };
      if (parsed.length === 0) return { kind: "failed", reason: `linted no files under ${patterns.join(" ")}` };

      const offsetOf = createOffsetReader(root);
      const findings: RunnerFinding[] = [];

      for (const entry of parsed as readonly RawResult[]) {
        const file = typeof entry.filePath === "string" ? entry.filePath : null;
        if (file === null || !Array.isArray(entry.messages)) return { kind: "failed", reason: SHAPE };

        for (const raw of entry.messages as readonly RawMessage[]) {
          if (raw.fatal === true) {
            return { kind: "failed", reason: `${file} could not be parsed: ${summarize(raw.message)}` };
          }

          const category = typeof raw.ruleId === "string" ? raw.ruleId : UNATTRIBUTED;
          if (categories !== undefined && !categories.includes(category)) continue;

          const line = typeof raw.line === "number" ? raw.line : null;
          const column = typeof raw.column === "number" ? raw.column : 1;

          findings.push({
            category,
            message: typeof raw.message === "string" ? raw.message : category,
            file,
            start: line === null ? null : offsetOf(file, line, column - 1),
            severity: raw.severity === WARNING_SEVERITY ? "warning" : "error",
          });
        }
      }

      return { kind: "findings", findings };
    },
  };
}
