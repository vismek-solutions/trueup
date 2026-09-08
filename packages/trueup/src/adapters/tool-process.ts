import { spawnSync } from "node:child_process";
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

export function captureTool({ command, args, cwd }: ToolInvocation): Captured {
  const [executable, ...rest] = command;
  if (executable === undefined) return { kind: "failed", reason: "no command configured" };

  const result = spawnSync(executable, [...rest, ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  });

  if (result.error !== undefined) return { kind: "failed", reason: result.error.message };
  if (result.status === null) return { kind: "failed", reason: "the process was killed before it finished" };

  return {
    kind: "captured",
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
    status: result.status,
  };
}

export type ToolJson =
  | { readonly kind: "json"; readonly payload: Record<string, unknown>; readonly stderr: string }
  | { readonly kind: "failed"; readonly reason: string };

const silentReason = (status: number, stderr: string): string => {
  const detail = summarize(stderr);
  const banner = `no output (exit ${status})`;
  return detail === "" ? banner : `${banner}: ${detail}`;
};

export function readToolJson(invocation: ToolInvocation): ToolJson {
  const captured = captureTool(invocation);
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

export interface JsonRunnerPlan {
  readonly name: string;
  readonly invoke: (root: string) => ToolInvocation;
  readonly read: (source: JsonSource, root: string) => RunnerOutcome;
}

export const jsonRunner = ({ name, invoke, read }: JsonRunnerPlan): Runner => ({
  name,
  run: (root): RunnerOutcome => {
    const report = readToolJson(invoke(root));
    return report.kind === "failed" ? report : read(report, root);
  },
});
