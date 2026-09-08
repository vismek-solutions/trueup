import { writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { manifestIn } from "../../config/manifest.ts";
import { configIn, memberDirectories } from "../../config/members.ts";
import { toPosix } from "../../paths/posix.ts";
import { DEFAULT_COMMAND } from "../../report/invocation.ts";
import type { CommandInput } from "../command.ts";
import { EXIT_BAD_USAGE } from "../main.ts";
import { renderMember, renderRoot, runnerName, runnersFor } from "./render.ts";
import { workspaceGlobsIn } from "./workspace.ts";
import { sourceFilesIn, topDirectoriesIn, zonesFor, type ZoneLine } from "./zones.ts";

const CONFIG_NAME = "trueup.config.ts";

const MANY_ZONES = 10;

const NEXT = [
  "add `boundaries` to say which zones may reach which",
  "turn on `colocation`, `duplication` and `maxFilesPerDirectory` once a first run is clean",
  `run \`${DEFAULT_COMMAND}\` to see what it finds`,
];

interface Member {
  readonly path: string;
  readonly directory: string;
  readonly files: readonly string[];
  readonly zones: readonly ZoneLine[];
  readonly allow: readonly string[];
}

const named = (values: readonly string[]): string => values.join(" · ");

const put = (path: string, source: string): void => {
  writeFileSync(path, source, "utf8");
};

const membersByPackage = (directories: readonly string[]): ReadonlyMap<string, string> =>
  new Map(
    directories.flatMap((directory) => {
      const manifest = manifestIn(directory);
      return manifest === null || manifest.name === null
        ? []
        : [[manifest.name, basename(directory)] as const];
    }),
  );

const reachedBy = (directory: string, known: ReadonlyMap<string, string>): readonly string[] => {
  const manifest = manifestIn(directory);
  if (manifest === null) return [];

  const own = basename(directory);
  const reached = new Set(
    manifest.dependencies.flatMap((dependency) => {
      const member = known.get(dependency);
      return member === undefined || member === own ? [] : [member];
    }),
  );

  return [...reached].sort();
};

const uncoveredIn = (cwd: string, directories: readonly string[]): readonly string[] => {
  const inside = directories.map((directory) => `${toPosix(relative(cwd, directory))}/`);
  const loose = new Set(
    sourceFilesIn(cwd)
      .filter((file) => !inside.some((prefix) => file.startsWith(prefix)))
      .map((file) => (file.includes("/") ? file.slice(0, file.indexOf("/")) : file)),
  );

  return [...loose].sort();
};

interface Caveats {
  readonly cwd: string;
  readonly uncovered: readonly string[];
  readonly bare: readonly Member[];
  readonly crowded: readonly Member[];
}

const caveats = ({ cwd, uncovered, bare, crowded }: Caveats, write: (line: string) => void): void => {
  if (uncovered.length > 0) {
    write("");
    write(`no zone   ${named(uncovered)}`);
    write("          source no member claims; give it zones in the root config, or it fails as");
    write("          unclassified and your linters never see it");
  }

  if (bare.length > 0) {
    write("");
    write(`no source ${named(bare.map((member) => relative(cwd, member.directory)))}`);
    write("          their zones match nothing until those hold code, or narrow `members`");
  }

  for (const member of crowded) {
    write("");
    write(`crowded   ${basename(member.directory)} got ${member.zones.length} zones, one per folder`);
    write("          consider merging any two you would never write a rule between");
  }
};

export function runInit({ cwd, argv, write }: CommandInput): number {
  if (argv.length > 0) {
    write(`unrecognised: ${argv.join(" ")}`);
    write(`usage: ${DEFAULT_COMMAND} init`);
    return EXIT_BAD_USAGE;
  }

  const existing = configIn(cwd);
  if (existing !== null) {
    write(`${relative(cwd, existing)} already exists, so nothing was written`);
    return EXIT_BAD_USAGE;
  }

  const globs = workspaceGlobsIn(cwd);
  const directories = globs.length === 0 ? [] : memberDirectories(cwd, globs);
  const federated = directories.length > 0;
  const known = membersByPackage(directories);

  const kept = directories.filter((directory) => configIn(directory) !== null);
  const members: readonly Member[] = directories
    .filter((directory) => configIn(directory) === null)
    .map((directory) => {
      const files = sourceFilesIn(directory);
      return {
        directory,
        files,
        path: join(directory, CONFIG_NAME),
        zones: zonesFor(directory, files),
        allow: reachedBy(directory, known),
      };
    });

  const zones = federated ? [] : zonesFor(cwd, sourceFilesIn(cwd));
  const scoped = topDirectoriesIn(federated ? globs : zones.flatMap((zone) => zone.patterns));
  const runners = runnersFor(manifestIn(cwd)?.dependencies ?? [], scoped);
  const uncovered = federated ? uncoveredIn(cwd, directories) : [];

  put(join(cwd, CONFIG_NAME), renderRoot({ members: federated ? globs : [], zones, runners }));
  for (const member of members) put(member.path, renderMember(member.zones, member.allow));

  write(`wrote ${CONFIG_NAME}`);
  for (const member of members) write(`wrote ${relative(cwd, member.path)}`);
  for (const directory of kept) write(`kept  ${relative(cwd, join(directory, CONFIG_NAME))}, already there`);
  write("");

  write(federated ? `members   ${named(globs)}` : `zones     ${named(zones.map((zone) => zone.name))}`);
  const wired = runners.length === 0 ? "none, no linter in package.json" : named(runners.map(runnerName));
  write(`runners   ${wired}${scoped.length === 0 ? "" : `, over ${named(scoped)} only`}`);

  caveats(
    {
      cwd,
      uncovered,
      bare: members.filter((member) => member.files.length === 0),
      crowded: members.filter((member) => member.zones.length > MANY_ZONES),
    },
    write,
  );

  write("");
  write(`next      ${NEXT.join("\n          ")}`);
  return 0;
}
