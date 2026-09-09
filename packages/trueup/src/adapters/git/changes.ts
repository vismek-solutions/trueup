import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChangeSet, Changes, FileChange } from "../../ports/changes.ts";
import { captureTool } from "../tool-process.ts";
import { summarize } from "../tool-output.ts";

const countOf = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const tracked = (stdout: string): FileChange[] =>
  stdout
    .split("\n")
    .flatMap((line) => {
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
  const git = (root: string, args: readonly string[]) =>
    captureTool({ command, args: ["-C", root, ...args] });

  return {
    since: (root, base): ChangeSet => {
      const point = git(root, ["merge-base", "HEAD", base]);
      if (point.kind === "failed") return { kind: "unmeasured", reason: point.reason };
      if (point.status !== 0) return refused(`no common commit with ${base}`, point.stderr);

      const at = point.stdout.trim();
      const diff = git(root, ["diff", "--numstat", "--no-renames", at, "--"]);
      if (diff.kind === "failed") return { kind: "unmeasured", reason: diff.reason };
      if (diff.status !== 0) return refused(`could not read the change since ${base}`, diff.stderr);

      const others = git(root, ["ls-files", "--others", "--exclude-standard"]);
      const added = others.kind === "captured" && others.status === 0 ? others.stdout : "";

      return { kind: "measured", base, files: [...tracked(diff.stdout), ...untracked(root, added)] };
    },
  };
};
