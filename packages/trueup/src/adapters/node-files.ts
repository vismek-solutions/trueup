import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import picomatch from "picomatch";
import { toPosix } from "../paths/posix.ts";

export const namedAsset = (root: string, patterns: readonly string[]): ((path: string) => boolean) => {
  if (patterns.length === 0) return () => false;

  const isMatch = picomatch([...patterns], { dot: true });
  return (path) => isMatch(toPosix(relative(root, path)));
};

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

function discoverFiles(
  {
    roots,
    extensions = SOURCE_EXTENSIONS,
    ignoreDirectories = IGNORED_DIRECTORIES,
    ignoreFiles = [],
  }: DiscoverFilesOptions,
  proposed: Iterable<string> = [],
): string[] {
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
  for (const path of proposed) if (!excluded.has(path)) found.push(path);
  return [...new Set(found)].sort();
}

interface DiscoverAssetsOptions {
  readonly root: string;
  readonly roots: readonly string[];
  readonly patterns: readonly string[];
  readonly ignoreDirectories?: readonly string[] | undefined;
}

function discoverAssets(
  { root, roots, patterns, ignoreDirectories = IGNORED_DIRECTORIES }: DiscoverAssetsOptions,
  proposed: Iterable<string> = [],
): string[] {
  if (patterns.length === 0) return [];

  const skipped = new Set(ignoreDirectories);
  const wanted = namedAsset(root, patterns);
  const found: string[] = [];

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!skipped.has(entry.name)) walk(path);
        continue;
      }
      if (entry.isFile() && wanted(path)) found.push(path);
    }
  };

  for (const one of roots) walk(one);
  for (const path of proposed) if (wanted(path)) found.push(path);
  return [...new Set(found)].sort();
}

export const readSource = (path: string): string => readFileSync(path, "utf8");

export type Overlaid = ReadonlyMap<string, string>;

const NOTHING_OVERLAID: Overlaid = new Map();

export const readSources = (
  options: DiscoverFilesOptions,
  overlaid: Overlaid = NOTHING_OVERLAID,
  proposed: Iterable<string> = overlaid.keys(),
): Map<string, string> =>
  new Map(discoverFiles(options, proposed).map((path) => [path, overlaid.get(path) ?? readSource(path)]));

export interface ReadSetsOptions extends DiscoverFilesOptions {
  readonly root: string;
  readonly assets?: readonly string[] | undefined;
}

export interface FileSets {
  readonly sources: Map<string, string>;
  readonly assets: Map<string, string>;
}

export function readSets(options: ReadSetsOptions, overlaid: Overlaid = NOTHING_OVERLAID): FileSets {
  const { root, assets: patterns = [], ...discovery } = options;
  const asset = namedAsset(root, patterns);
  // an overlaid path joins the analysis whatever its extension, so the patterns decide which set it joins
  const sources = readSources(
    discovery,
    overlaid,
    [...overlaid.keys()].filter((path) => !asset(path)),
  );
  const found = discoverAssets(
    { root, roots: discovery.roots, patterns, ignoreDirectories: discovery.ignoreDirectories },
    overlaid.keys(),
  );

  return {
    sources,
    assets: new Map(found.map((path) => [path, overlaid.get(path) ?? readSource(path)])),
  };
}
