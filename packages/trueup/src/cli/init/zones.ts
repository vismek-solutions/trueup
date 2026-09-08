import { existsSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import picomatch from "picomatch";
import { IGNORED_DIRECTORIES, SOURCE_EXTENSIONS } from "../../adapters/node-files.ts";
import { exportedFilesIn } from "../../config/exports.ts";
import { toPosix } from "../../paths/posix.ts";

const TEST_DIRECTORIES = ["test", "tests", "__tests__"];

const CATCH_ALL = ["app", "wiring", "everything"];

const SOURCE_ROOT = "src/";

const GLOBBED = /[*?[\]{}!]/;

const skipped = new Set(IGNORED_DIRECTORIES);

export interface ZoneLine {
  readonly name: string;
  readonly patterns: readonly string[];
  readonly declaration: string;
}

interface Draft {
  readonly name: string;
  readonly patterns: readonly string[];
  readonly role?: string | undefined;
}

const declare = ({ name, patterns, role }: Draft): ZoneLine => {
  const listed = patterns.map((pattern) => `"${pattern}"`).join(", ");
  const suffix = role === undefined ? "" : `, role: "${role}"`;
  return { name, patterns, declaration: `{ name: "${name}", patterns: [${listed}]${suffix} }` };
};

export const sourceFilesIn = (directory: string): readonly string[] => {
  const found: string[] = [];

  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) {
        if (!skipped.has(entry.name)) walk(path);
      } else if (SOURCE_EXTENSIONS.includes(extname(entry.name))) {
        found.push(toPosix(relative(directory, path)));
      }
    }
  };

  if (existsSync(directory)) walk(directory);
  return found;
};

const unique = (values: readonly string[]): readonly string[] => [...new Set(values)];

const freeName = (base: string, taken: ReadonlySet<string>): string => {
  if (!taken.has(base)) return base;
  const tried = [2, 3, 4, 5, 6, 7, 8, 9].map((suffix) => `${base}${suffix}`);
  return tried.find((candidate) => !taken.has(candidate)) ?? `${base}-zone`;
};

const groupsUnder = (files: readonly string[], prefix: string): readonly string[] =>
  unique(
    files
      .filter((file) => file.startsWith(prefix))
      .map((file) => file.slice(prefix.length).split("/"))
      .filter((segments) => segments.length > 1)
      .map((segments) => segments[0] ?? ""),
  ).filter((name) => name !== "");

const doorsIn = (directory: string, files: readonly string[]): readonly Draft[] => {
  const surface = exportedFilesIn(directory);
  if (surface === null) return [];

  const published = unique(
    surface.files
      .map((entry) => toPosix(relative(directory, entry.file)))
      .filter((pattern) => files.includes(pattern)),
  );

  return published.length === 0 ? [] : [{ name: "api", patterns: published, role: "api" }];
};

const draftsFor = (directory: string, files: readonly string[]): readonly Draft[] => {
  const taken = new Set<string>();
  const claim = (draft: Draft): Draft => {
    const name = freeName(draft.name, taken);
    taken.add(name);
    return { ...draft, name };
  };

  const doors = doorsIn(directory, files).map(claim);
  const tests = claim({
    name: "spec",
    patterns: [...TEST_DIRECTORIES.map((name) => `${name}/**`), "**/*.test.*", "**/*.spec.*"],
    role: "tests",
  });

  const nested = groupsUnder(files, SOURCE_ROOT).map((name) =>
    claim({ name, patterns: [`${SOURCE_ROOT}${name}/**`] }),
  );
  const beside = groupsUnder(files, "")
    .filter((name) => name !== "src")
    .map((name) => claim({ name, patterns: [`${name}/**`] }));

  return [...doors, tests, ...nested, ...beside, claim({ name: CATCH_ALL[0] ?? "app", patterns: ["**"] })];
};

const claiming = (draft: Draft, left: Set<string>): Draft => {
  const kept: string[] = [];

  for (const pattern of draft.patterns) {
    const matches = picomatch(pattern);
    const owned = [...left].filter((file) => matches(file));
    if (owned.length === 0) continue;

    for (const file of owned) left.delete(file);
    kept.push(pattern);
  }

  return { ...draft, patterns: kept };
};

export const zonesFor = (directory: string, files: readonly string[]): readonly ZoneLine[] => {
  const left = new Set(files);
  const kept: ZoneLine[] = [];

  for (const draft of draftsFor(directory, files)) {
    const alive = claiming(draft, left);
    if (alive.patterns.length > 0) kept.push(declare(alive));
  }

  return kept;
};

export const topDirectoriesIn = (patterns: readonly string[]): readonly string[] =>
  unique(
    patterns.flatMap((pattern) => {
      const head = pattern.split("/")[0];
      return head === undefined || head === "" || GLOBBED.test(head) ? [] : [head];
    }),
  );
