import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { manifestIn } from "../../config/manifest.ts";
import { configIn, memberDirectories } from "../../config/members.ts";
import { DEFAULT_COMMAND } from "../../report/invocation.ts";
import type { CommandInput } from "../command.ts";
import { EXIT_BAD_USAGE } from "../main.ts";
import { renderMember, renderRoot, runnerName, runnersFor } from "./render.ts";
import { workspaceGlobsIn } from "./workspace.ts";
import { holdsSourceIn, topDirectoriesIn, zonesFor, type ZoneLine } from "./zones.ts";

const CONFIG_NAME = "trueup.config.ts";

const NEXT = [
  "add `boundaries` to say which zones may reach which",
  "turn on `colocation`, `duplication` and `maxFilesPerDirectory` once a first run is clean",
  `run \`${DEFAULT_COMMAND}\` to see what it finds`,
];

interface Member {
  readonly path: string;
  readonly directory: string;
  readonly zones: readonly ZoneLine[];
}

const named = (values: readonly string[]): string => values.join(" · ");

const put = (path: string, source: string): void => {
  writeFileSync(path, source, "utf8");
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

  const kept = directories.filter((directory) => configIn(directory) !== null);
  const members: readonly Member[] = directories
    .filter((directory) => configIn(directory) === null)
    .map((directory) => ({ directory, path: join(directory, CONFIG_NAME), zones: zonesFor(directory) }));

  const bare = members.filter((member) => !holdsSourceIn(member.directory));
  const zones = federated ? [] : zonesFor(cwd);
  const scoped = topDirectoriesIn(federated ? globs : zones.flatMap((zone) => zone.patterns));
  const runners = runnersFor(manifestIn(cwd)?.dependencies ?? [], scoped);

  put(join(cwd, CONFIG_NAME), renderRoot({ members: federated ? globs : [], zones, runners }));
  for (const member of members) put(member.path, renderMember(member.zones));

  write(`wrote ${CONFIG_NAME}`);
  for (const member of members) write(`wrote ${relative(cwd, member.path)}`);
  for (const directory of kept) write(`kept  ${relative(cwd, join(directory, CONFIG_NAME))}, already there`);
  write("");

  write(federated ? `members   ${named(globs)}` : `zones     ${named(zones.map((zone) => zone.name))}`);
  const wired = runners.length === 0 ? "none, no linter in package.json" : named(runners.map(runnerName));
  write(`runners   ${wired}`);

  if (bare.length > 0) {
    write("");
    write(`no source ${named(bare.map((member) => relative(cwd, member.directory)))}`);
    write("          their zones match nothing until those hold code, or narrow `members`");
  }

  write("");
  write(`next      ${NEXT.join("\n          ")}`);
  return 0;
}
