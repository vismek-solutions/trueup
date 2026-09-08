import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

export interface Manifest {
  readonly name: string | null;
  readonly exports: unknown;
  readonly workspaces: unknown;
  readonly dependencies: readonly string[];
}

const namesIn = (parsed: Record<string, unknown>): readonly string[] =>
  DEPENDENCY_FIELDS.flatMap((field) => {
    const value = parsed[field];
    return value === null || typeof value !== "object" ? [] : Object.keys(value);
  });

export const manifestIn = (directory: string): Manifest | null => {
  const path = join(directory, "package.json");
  if (!existsSync(path)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;

  return {
    name: typeof record.name === "string" ? record.name : null,
    exports: record.exports,
    workspaces: record.workspaces,
    dependencies: namesIn(record),
  };
};
