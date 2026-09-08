import { existsSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import picomatch from "picomatch";
import { IGNORED_DIRECTORIES, SOURCE_EXTENSIONS } from "../../adapters/node-files.ts";
import { exportedFilesIn } from "../../config/exports.ts";
import { toPosix } from "../../paths/posix.ts";

const TEST_DIRECTORIES = ["test", "tests", "__tests__"];

const CATCH_ALL = "app";

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

const freeName = (base: string, taken: ReadonlySet<string>, suffix = 1): string => {
  const candidate = suffix === 1 ? base : `${base}${suffix}`;
  return taken.has(candidate) ? freeName(base, taken, suffix + 1) : candidate;
};

const groupsUnder = (files: readonly string[], prefix: string): readonly string[] =>
  unique(
    files
      .filter((file) => file.startsWith(prefix) && file.slice(prefix.length).includes("/"))
      .map((file) => file.slice(prefix.length, file.indexOf("/", prefix.length))),
  );

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

  return [...doors, tests, ...nested, ...beside, claim({ name: CATCH_ALL, patterns: ["**"] })];
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

  if (kept.length > 0) return kept;
  return [declare({ name: CATCH_ALL, patterns: ["**"] })];
};

export const topDirectoriesIn = (patterns: readonly string[]): readonly string[] =>
  unique(
    patterns.flatMap((pattern) => {
      const head = pattern.includes("/") ? pattern.slice(0, pattern.indexOf("/")) : pattern;
      return head === "" || GLOBBED.test(head) ? [] : [head];
    }),
  );
