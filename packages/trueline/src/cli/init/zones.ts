import { existsSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { IGNORED_DIRECTORIES, SOURCE_EXTENSIONS } from "../../adapters/node-files.ts";

const TEST_DIRECTORIES = ["test", "tests", "__tests__"];

const CATCH_ALL = ["app", "wiring", "everything"];

const skipped = new Set(IGNORED_DIRECTORIES);

const GLOBBED = /[*?[\]{}!]/;

export interface ZoneLine {
  readonly name: string;
  readonly patterns: readonly string[];
  readonly declaration: string;
}

const declare = (name: string, patterns: readonly string[], role?: string): ZoneLine => {
  const listed = patterns.map((pattern) => `"${pattern}"`).join(", ");
  const suffix = role === undefined ? "" : `, role: "${role}"`;
  return { name, patterns, declaration: `{ name: "${name}", patterns: [${listed}]${suffix} }` };
};

export const topDirectoriesIn = (patterns: readonly string[]): readonly string[] => [
  ...new Set(
    patterns.flatMap((pattern) => {
      const head = pattern.split("/")[0];
      return head === undefined || head === "" || GLOBBED.test(head) ? [] : [head];
    }),
  ),
];

const isSource = (name: string): boolean => SOURCE_EXTENSIONS.includes(extname(name));

const entriesIn = (directory: string) =>
  existsSync(directory) ? readdirSync(directory, { withFileTypes: true }) : [];

const someFileIn = (directory: string, wanted: (name: string) => boolean): boolean =>
  entriesIn(directory).some((entry) =>
    entry.isDirectory()
      ? !skipped.has(entry.name) && someFileIn(join(directory, entry.name), wanted)
      : wanted(entry.name),
  );

const isTest = (name: string): boolean => isSource(name) && /\.(test|spec)\./.test(name);

export const holdsSourceIn = (directory: string): boolean => someFileIn(directory, isSource);

const testZonesFor = (directory: string, owned: string | undefined): readonly ZoneLine[] => {
  if (owned !== undefined) return [declare("spec", [`${owned}/**`], "tests")];

  return someFileIn(directory, isTest) ? [declare("spec", ["**/*.test.*", "**/*.spec.*"], "tests")] : [];
};

const groupsIn = (source: string, prefix: string, apart: readonly string[]): readonly ZoneLine[] =>
  entriesIn(source)
    .filter((entry) => entry.isDirectory() && !skipped.has(entry.name) && !apart.includes(entry.name))
    .filter((entry) => someFileIn(join(source, entry.name), isSource))
    .map((entry) => declare(entry.name, [`${prefix}${entry.name}/**`]));

const filesDirectlyIn = (directory: string): boolean =>
  entriesIn(directory).some((entry) => !entry.isDirectory() && isSource(entry.name));

const unusedIn = (taken: readonly string[]): string =>
  CATCH_ALL.find((name) => !taken.includes(name)) ?? "unclaimed";

export const zonesFor = (directory: string): readonly ZoneLine[] => {
  const owned = TEST_DIRECTORIES.find((name) => someFileIn(join(directory, name), isSource));
  const tests = testZonesFor(directory, owned);
  const source = join(directory, "src");
  const nested = existsSync(source);
  const root = nested ? source : directory;
  const prefix = nested ? "src/" : "";

  const groups = groupsIn(root, prefix, owned === undefined ? [] : [owned]);
  const sweeps = groups.length === 0 || filesDirectlyIn(root);
  const taken = [...tests, ...groups].map((zone) => zone.name);
  const rest = sweeps ? [declare(unusedIn(taken), [`${prefix}**`], "wiring")] : [];

  return [...tests, ...groups, ...rest];
};
