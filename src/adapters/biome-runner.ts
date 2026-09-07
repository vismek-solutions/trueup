import { spawnSync } from "node:child_process";
import { isAbsolute, join } from "node:path";
import type { Runner, RunnerFinding, RunnerOutcome } from "../ports/runner.ts";
import type { Severity } from "../ports/severity.ts";
import { createOffsetReader } from "./source-offset.ts";
import { numberOf, objectOf, stringOf, summarize } from "./tool-output.ts";

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

const wanted = (category: string, categories: readonly string[] | undefined): boolean =>
  categories === undefined ||
  categories.some((prefix) => category === prefix || category.startsWith(`${prefix}/`));

export function biomeRunner(options: BiomeRunnerOptions = {}): Runner {
  const command = options.command ?? ["npx", "--yes", "@biomejs/biome", "lint"];
  const paths = options.paths ?? ["."];
  const categories = options.categories;
  const maxDiagnostics = options.maxDiagnostics ?? DEFAULT_MAX_DIAGNOSTICS;
  const fixing = options.write === true ? ["--write"] : [];

  return {
    name: "biome",
    run: (root): RunnerOutcome => {
      const [executable, ...rest] = command;
      if (executable === undefined) return { kind: "failed", reason: "no command configured" };

      const result = spawnSync(
        executable,
        [...rest, ...fixing, "--reporter=json", `--max-diagnostics=${maxDiagnostics}`, ...paths],
        { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      );

      if (result.error !== undefined) return { kind: "failed", reason: result.error.message };
      if (result.status === null) return { kind: "failed", reason: "the process was killed before it finished" };
      if (typeof result.stdout !== "string" || result.stdout.trim() === "") {
        return { kind: "failed", reason: `no output (exit ${result.status}): ${summarize(result.stderr)}` };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return { kind: "failed", reason: "output was not JSON" };
      }

      const report = objectOf(parsed);
      const summary = report === null ? null : objectOf(report.summary);
      const diagnostics = report === null ? null : report.diagnostics;
      if (summary === null || !Array.isArray(diagnostics)) return { kind: "failed", reason: SHAPE };

      const changed = numberOf(summary.changed);
      const unchanged = numberOf(summary.unchanged);
      if (changed === null || unchanged === null) return { kind: "failed", reason: SHAPE };
      if (changed + unchanged === 0) {
        return { kind: "failed", reason: `processed no files under ${paths.join(" ")}: ${summarize(result.stderr)}` };
      }

      const withheld = numberOf(summary.diagnosticsNotPrinted) ?? 0;
      if (withheld > 0) {
        return { kind: "failed", reason: `biome withheld ${withheld} diagnostics; raise maxDiagnostics above ${maxDiagnostics}` };
      }

      const offsetOf = createOffsetReader(root);
      const findings: RunnerFinding[] = [];

      for (const entry of diagnostics) {
        const raw = objectOf(entry);
        const category = raw === null ? null : stringOf(raw.category);
        if (raw === null || category === null) return { kind: "failed", reason: SHAPE };

        const location = objectOf(raw.location);
        const reported = location === null ? null : stringOf(location.path);
        const path = reported === null ? null : isAbsolute(reported) ? reported : join(root, reported);

        if (UNCHECKED.some((prefix) => category.startsWith(prefix))) {
          return { kind: "failed", reason: `${path ?? "a file"} was not checked: ${summarize(raw.message)}` };
        }

        const severity = SEVERITIES[stringOf(raw.severity) ?? ""];
        if (severity === undefined) {
          return { kind: "failed", reason: `biome reported an unrecognised severity ${JSON.stringify(raw.severity)}` };
        }

        if (!wanted(category, categories)) continue;

        const start = location === null ? null : objectOf(location.start);
        const line = start === null ? null : numberOf(start.line);
        const column = (start === null ? null : numberOf(start.column)) ?? 1;
        const message = summarize(raw.message);

        findings.push({
          category,
          message: message === "" ? category : message,
          file: path,
          start: path === null || line === null ? null : offsetOf(path, line, column - 1),
          severity,
        });
      }

      return { kind: "findings", findings };
    },
  };
}
