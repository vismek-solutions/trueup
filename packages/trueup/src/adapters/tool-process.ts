import { execFile } from "node:child_process";
import type { Runner, RunnerOutcome } from "../ports/runner.ts";
import { objectOf, summarize } from "./tool-output.ts";

const MAX_BUFFER = 64 * 1024 * 1024;

export interface ToolInvocation {
  readonly command: readonly string[];
  readonly args: readonly string[];
  readonly cwd?: string | undefined;
}

export type Captured =
  | { readonly kind: "captured"; readonly stdout: string; readonly stderr: string; readonly status: number }
  | { readonly kind: "failed"; readonly reason: string };

const KILLED = "the process was killed before it finished";

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

const capturedFrom = (status: number, stdout: unknown, stderr: unknown): Captured => ({
  kind: "captured",
  stdout: textOf(stdout),
  stderr: textOf(stderr),
  status,
});

interface SpawnFailure extends Error {
  readonly code?: number | string | undefined;
  readonly signal?: string | null | undefined;
}

// a non-zero exit is how these tools report findings, so only a spawn error is a failure
export function awaitTool({ command, args, cwd }: ToolInvocation): Promise<Captured> {
  const [executable, ...rest] = command;
  if (executable === undefined) {
    return Promise.resolve({ kind: "failed", reason: "no command configured" });
  }

  return new Promise((settle) => {
    execFile(
      executable,
      [...rest, ...args],
      { cwd, encoding: "utf8", maxBuffer: MAX_BUFFER },
      (error, stdout, stderr) => {
        const failure = error as SpawnFailure | null;
        if (failure === null) return settle(capturedFrom(0, stdout, stderr));
        if (typeof failure.code === "number") {
          return settle(capturedFrom(failure.code, stdout, stderr));
        }
        const signalled = failure.signal !== undefined && failure.signal !== null;
        return settle({ kind: "failed", reason: signalled ? KILLED : failure.message });
      },
    );
  });
}

export type ToolJson =
  | { readonly kind: "json"; readonly payload: Record<string, unknown>; readonly stderr: string }
  | { readonly kind: "failed"; readonly reason: string };

const silentReason = (status: number, stderr: string): string => {
  const detail = summarize(stderr);
  const banner = `no output (exit ${status})`;
  return detail === "" ? banner : `${banner}: ${detail}`;
};

export async function readToolJson(invocation: ToolInvocation): Promise<ToolJson> {
  const captured = await awaitTool(invocation);
  if (captured.kind === "failed") return captured;
  if (captured.stdout.trim() === "") {
    return { kind: "failed", reason: silentReason(captured.status, captured.stderr) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(captured.stdout);
  } catch {
    return { kind: "failed", reason: "output was not JSON" };
  }

  const payload = objectOf(parsed);
  return payload === null
    ? { kind: "failed", reason: "output was not a JSON object" }
    : { kind: "json", payload, stderr: captured.stderr };
}

export interface JsonSource {
  readonly payload: Record<string, unknown>;
  readonly stderr: string;
}

export interface ToolOptions {
  readonly command?: readonly string[] | undefined;
  readonly paths?: readonly string[] | undefined;
  readonly write?: boolean | undefined;
}

export interface ToolDefaults {
  readonly command: readonly string[];
  readonly fix: readonly string[];
}

export interface ToolCall {
  readonly command: readonly string[];
  readonly paths: readonly string[];
  readonly fixing: readonly string[];
}

export const toolCallFrom = (options: ToolOptions, defaults: ToolDefaults): ToolCall => ({
  command: options.command ?? defaults.command,
  paths: options.paths ?? ["."],
  fixing: options.write === true ? defaults.fix : [],
});

export interface JsonRunnerPlan {
  readonly name: string;
  readonly invoke: (root: string) => ToolInvocation;
  readonly read: (source: JsonSource, root: string) => RunnerOutcome | Promise<RunnerOutcome>;
}

export const jsonRunner = ({ name, invoke, read }: JsonRunnerPlan): Runner => ({
  name,
  run: async (root): Promise<RunnerOutcome> => {
    const report = await readToolJson(invoke(root));
    return report.kind === "failed" ? report : read(report, root);
  },
});
