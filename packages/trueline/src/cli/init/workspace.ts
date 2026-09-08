import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { manifestIn } from "../../config/manifest.ts";

const WORKSPACE_FILES = ["pnpm-workspace.yaml", "pnpm-workspace.yml"];

const SEQUENCE = /^\s*-\s*(.+?)\s*$/;

const unquoted = (value: string): string => value.replace(/^["']|["']$/g, "");

const packagesIn = (text: string): readonly string[] => {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => /^packages:\s*$/.test(line));
  if (start === -1) return [];

  const globs: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const entry = SEQUENCE.exec(line);
    if (entry?.[1] === undefined) break;
    globs.push(unquoted(entry[1]));
  }
  return globs;
};

const declaredIn = (value: unknown): readonly string[] => {
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === "string");
  if (value === null || typeof value !== "object") return [];
  return declaredIn((value as { packages?: unknown }).packages);
};

export const workspaceGlobsIn = (root: string): readonly string[] => {
  for (const name of WORKSPACE_FILES) {
    const path = join(root, name);
    if (existsSync(path)) return packagesIn(readFileSync(path, "utf8"));
  }

  const manifest = manifestIn(root);
  return manifest === null ? [] : declaredIn(manifest.workspaces);
};
