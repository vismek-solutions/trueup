import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

export const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

export const IGNORED_DIRECTORIES = [
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".turbo",
];

export interface DiscoverFilesOptions {
  readonly roots: readonly string[];
  readonly extensions?: readonly string[] | undefined;
  readonly ignoreDirectories?: readonly string[] | undefined;
  readonly ignoreFiles?: readonly string[] | undefined;
}

export function discoverFiles({
  roots,
  extensions = SOURCE_EXTENSIONS,
  ignoreDirectories = IGNORED_DIRECTORIES,
  ignoreFiles = [],
}: DiscoverFilesOptions): string[] {
  const allowed = new Set(extensions);
  const skipped = new Set(ignoreDirectories);
  const excluded = new Set(ignoreFiles);
  const found: string[] = [];

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!skipped.has(entry.name)) walk(path);
        continue;
      }
      if (entry.isFile() && allowed.has(extname(entry.name)) && !excluded.has(path)) found.push(path);
    }
  };

  for (const root of roots) walk(root);
  return found.sort();
}

export const readSource = (path: string): string => readFileSync(path, "utf8");
