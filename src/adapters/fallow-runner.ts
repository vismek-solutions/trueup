import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { Runner, RunnerFinding, RunnerOutcome } from "../ports/runner.ts";
import type { Severity } from "../ports/severity.ts";

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

const offsetOf = (root: string, path: string, line: number, column: number, cache: Map<string, string[]>): number | null => {
  const absolute = isAbsolute(path) ? path : join(root, path);
  let lines = cache.get(absolute);
  if (lines === undefined) {
    try {
      lines = readFileSync(absolute, "utf8").split("\n");
    } catch {
      lines = [];
    }
    cache.set(absolute, lines);
  }
  if (lines.length === 0 || line < 1) return null;

  let offset = 0;
  for (let index = 0; index < line - 1 && index < lines.length; index += 1) {
    offset += (lines[index]?.length ?? 0) + 1;
  }
  return offset + Math.max(column, 0);
};

const describe = (category: string, raw: RawFinding): string => {
  const named = typeof raw.export_name === "string" ? raw.export_name : typeof raw.name === "string" ? raw.name : null;
  const cycle = Array.isArray(raw.cycle) ? raw.cycle.join(" -> ") : null;
  const subject = named ?? cycle ?? (typeof raw.path === "string" ? raw.path : "");
  return subject === "" ? category.replaceAll("_", " ") : `${category.replaceAll("_", " ")}: ${subject}`;
};

export function fallowRunner(options: FallowRunnerOptions = {}): Runner {
  const command = options.command ?? ["npx", "--yes", "fallow@latest"];
  const categories = options.categories ?? [...DEFAULT_FALLOW_CATEGORIES];
  const severity = options.severity ?? "error";

  return {
    name: "fallow",
    run: (root): RunnerOutcome => {
      const [executable, ...rest] = command;
      if (executable === undefined) return { kind: "failed", reason: "no command configured" };

      const result = spawnSync(
        executable,
        [...rest, "--root", root, "--format", "json", "--quiet"],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      );

      if (result.error !== undefined) return { kind: "failed", reason: result.error.message };
      if (typeof result.stdout !== "string" || result.stdout.trim() === "") {
        return { kind: "failed", reason: `no output (exit ${result.status ?? "unknown"})` };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return { kind: "failed", reason: "output was not JSON" };
      }

      const check = (parsed as { check?: { schema_version?: unknown } }).check;
      if (check === undefined || check === null || typeof check !== "object") {
        return { kind: "failed", reason: "output carried no check section" };
      }
      if (check.schema_version !== FALLOW_CHECK_SCHEMA) {
        return {
          kind: "failed",
          reason: `check schema ${String(check.schema_version)} is not the expected ${FALLOW_CHECK_SCHEMA}`,
        };
      }

      const cache = new Map<string, string[]>();
      const findings: RunnerFinding[] = [];

      for (const category of categories) {
        const entries = (check as Record<string, unknown>)[category];
        if (!Array.isArray(entries)) continue;

        for (const entry of entries) {
          const raw = entry as RawFinding;
          const path = typeof raw.path === "string" ? (isAbsolute(raw.path) ? raw.path : join(root, raw.path)) : null;
          const line = typeof raw.line === "number" ? raw.line : null;
          const column = typeof raw.col === "number" ? raw.col : 0;

          findings.push({
            category,
            message: describe(category, raw),
            file: path,
            start: path === null || line === null ? null : offsetOf(root, path, line, column, cache),
            severity,
          });
        }
      }

      return { kind: "findings", findings };
    },
  };
}
