import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChangeSet, Changes, FileChange } from "../../ports/changes.ts";
import { summarize } from "../tool-output.ts";

const MAX_BUFFER = 64 * 1024 * 1024;

interface Ran {
  readonly failure: string | null;
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

const NOTHING: Ran = { failure: null, status: 0, stdout: "", stderr: "" };

const failing = (failure: string): Ran => ({ ...NOTHING, failure });

// the review budget asks for the change set while claims run, so this one stays synchronous
const ran = (executable: string | undefined, args: readonly string[]): Ran => {
  if (executable === undefined) return failing("no command configured");

  const result = spawnSync(executable, args, { encoding: "utf8", maxBuffer: MAX_BUFFER });
  if (result.error !== undefined) return failing(result.error.message);
  if (result.status === null) return failing("the process was killed before it finished");

  return {
    failure: null,
    status: result.status,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
  };
};

const countOf = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const tracked = (stdout: string): FileChange[] =>
  stdout.split("\n").flatMap((line) => {
    const [added = "", removed = "", ...rest] = line.split("\t");
    const file = rest.join("\t");
    return file === "" ? [] : [{ file, added: countOf(added), removed: countOf(removed) }];
  });

const linesIn = (root: string, file: string): number => {
  let text: string;
  try {
    text = readFileSync(join(root, file), "utf8");
  } catch {
    return 0;
  }
  if (text === "" || text.includes("\0")) return 0;
  return text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
};

const untracked = (root: string, stdout: string): FileChange[] =>
  stdout
    .split("\n")
    .filter((file) => file !== "")
    .map((file) => ({ file, added: linesIn(root, file), removed: 0 }));

const refused = (reason: string, stderr: string): ChangeSet => {
  const detail = summarize(stderr);
  return { kind: "unmeasured", reason: detail === "" ? reason : `${reason}: ${detail}` };
};

export const gitChanges = (command: readonly string[] = ["git"]): Changes => {
  const [executable, ...rest] = command;
  const git = (root: string, args: readonly string[]) =>
    ran(executable, [...rest, "-C", root, ...args]);

  return {
    since: (root, base): ChangeSet => {
      const point = git(root, ["merge-base", "HEAD", base]);
      if (point.failure !== null) return { kind: "unmeasured", reason: point.failure };
      if (point.status !== 0) return refused(`no common commit with ${base}`, point.stderr);

      const at = point.stdout.trim();
      const diff = git(root, ["diff", "--numstat", "--no-renames", at, "--"]);
      if (diff.failure !== null) return { kind: "unmeasured", reason: diff.failure };
      if (diff.status !== 0) return refused(`could not read the change since ${base}`, diff.stderr);

      const others = git(root, ["ls-files", "--others", "--exclude-standard"]);
      const added = others.failure === null && others.status === 0 ? others.stdout : "";

      return { kind: "measured", base, files: [...tracked(diff.stdout), ...untracked(root, added)] };
    },
  };
};
