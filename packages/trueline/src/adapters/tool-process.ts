import { spawnSync } from "node:child_process";

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
