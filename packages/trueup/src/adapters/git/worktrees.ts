import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";

export interface Checkout {
  readonly root: string;
  readonly path: string;
}

const WORKTREE = "worktree ";

const realPathOf = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    const parent = dirname(path);
    return parent === path ? path : join(realPathOf(parent), basename(path));
  }
};

const within = (directory: string, path: string): boolean =>
  path === directory || path.startsWith(`${directory}${sep}`);

const worktreesOf = (root: string): string[] => {
  const listed = spawnSync("git", ["-C", root, "worktree", "list", "--porcelain"], { encoding: "utf8" });
  if (listed.status !== 0 || typeof listed.stdout !== "string") return [];

  return listed.stdout
    .split("\n")
    .filter((line) => line.startsWith(WORKTREE))
    .map((line) => realPathOf(line.slice(WORKTREE.length)));
};

const deepestHolding = (worktrees: readonly string[], path: string): string | undefined =>
  worktrees.filter((worktree) => within(worktree, path)).sort((a, b) => b.length - a.length)[0];

export function checkoutHolding(root: string, path: string): Checkout | null {
  const realRoot = realPathOf(root);
  const realPath = realPathOf(path);

  const worktrees = worktreesOf(root);
  const here = deepestHolding(worktrees, realRoot);
  const there = deepestHolding(worktrees, realPath);
  if (here !== undefined && there !== undefined && there !== here) {
    return { root: join(there, relative(here, realRoot)), path: realPath };
  }

  return within(realRoot, realPath) ? { root, path: join(root, relative(realRoot, realPath)) } : null;
}
