import { existsSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { check, homesFor, nameIn, placementOf, reachOf, ungovernedIn } from "../../main.ts";
import { resolveInclude } from "../../config/load.ts";
import { DEFAULT_COMMAND } from "../../report/invocation.ts";

import { EXIT_BAD_USAGE, type CommandInput } from "../command.ts";
import { openedIn, type Opened } from "../preamble.ts";
import { closesACycle, homeLines, probeFor, type Home } from "./homes.ts";
import { list } from "./lines.ts";
import { nameLines, type Blocked } from "./name.ts";
import { placementLinesFor, ungovernedLinesFor } from "./path.ts";
import { ungovernedLines } from "./ungoverned.ts";

const UNGOVERNED = "--ungoverned";

const NEEDS = "--needs=";

const READ_BY = "--read-by=";

const USAGE = [
  `usage: ${DEFAULT_COMMAND} explain <path>[#<name>] [<path>...]`,
  `       ${DEFAULT_COMMAND} explain ${NEEDS}<path>[,<path>] [${READ_BY}<path>[,<path>]]`,
];

const ungovernedFor = async (cwd: string, write: (line: string) => void): Promise<number> => {
  const opened = await openedIn(cwd, write);
  if (typeof opened === "number") return opened;

  const { config, project } = opened;
  for (const line of ungovernedLines(ungovernedIn(project, config.boundaries))) write(line);
  return 0;
};

const refusedMove = (opened: Opened, path: string, about: ReturnType<typeof nameIn>): Blocked | null => {
  const { config, project } = opened;
  const from = project.zoneOf(path);
  const zones = about.readers.zones.map((zone) => zone.name);
  if (from === null || !zones.includes(from)) return null;

  const { mayReach } = reachOf({ zone: from, zones: config.zones, boundaries: config.boundaries });
  const refused = zones.filter((zone) => zone !== from && !mayReach.includes(zone));

  return refused.length === 0 ? null : { from, zones: refused };
};

interface Target {
  readonly path: string;
  readonly name: string | null;
}

const nameLinesFor = async (opened: Opened, path: string, name: string): Promise<readonly string[]> => {
  const { config, root, project, rulebooks } = opened;
  const report = await check({
    ...config,
    root,
    roots: resolveInclude(root, config.include),
    ignoreFiles: rulebooks,
    runners: [],
  });

  const about = nameIn(project, path, name);
  const readers = new Set(about.readers.files);
  const against = report.claims.flatMap((claim) =>
    claim.findings.flatMap((finding) => {
      if (finding.symbols?.includes(name) !== true || finding.file === null) return [];
      const at = project.relative(finding.file);
      const mine = finding.file === path || readers.has(at);
      return mine ? [`${claim.claim}  ${at}  ${finding.message}`] : [];
    }),
  );

  const said = nameLines({
    about,
    against,
    command: config.command ?? DEFAULT_COMMAND,
    blocked: refusedMove(opened, path, about),
  });
  return [`${relative(root, path)}#${name}`, "", ...said];
};

const pathsOf = (argv: readonly string[], flag: string): readonly string[] =>
  (argv.find((entry) => entry.startsWith(flag))?.slice(flag.length) ?? "")
    .split(",")
    .filter((entry) => entry !== "");

const resolved = (cwd: string, entry: string): string => (isAbsolute(entry) ? entry : resolve(cwd, entry));

const zonesFor = (paths: readonly string[], cwd: string, project: Opened["project"]): readonly string[] => [
  ...new Set(
    paths.map((entry) => project.zoneOf(resolved(cwd, entry))).filter((zone): zone is string => zone !== null),
  ),
];

const unplaced = (paths: readonly string[], cwd: string, project: Opened["project"]): string | undefined =>
  paths.find((entry) => project.zoneOf(resolved(cwd, entry)) === null);

interface HomesFrom {
  readonly opened: Opened;
  readonly cwd: string;
  readonly argv: readonly string[];
  readonly write: (line: string) => void;
}

const homesFrom = ({ opened, cwd, argv, write }: HomesFrom): number => {
  const { config, root, project } = opened;
  const asked = [...pathsOf(argv, NEEDS), ...pathsOf(argv, READ_BY)];
  const unknown = unplaced(asked, cwd, project);

  if (unknown !== undefined) {
    write(`no zone covers ${unknown}`);
    write("Name a file this analysis reads, since the zone it sits in is what places the new one.");
    return EXIT_BAD_USAGE;
  }

  const needs = zonesFor(pathsOf(argv, NEEDS), cwd, project);
  const readers = zonesFor(pathsOf(argv, READ_BY), cwd, project);
  const rules = { zones: config.zones, boundaries: config.boundaries };
  const whereIn = (zone: string): string | null => {
    const probe = probeFor(project.filesIn(zone));
    if (probe === null) return null;
    return placementOf({ ...rules, root, path: probe }).zone === zone
      ? relative(root, dirname(probe)) || "."
      : null;
  };

  const homes: Home[] = homesFor({ ...rules, needs, readers }).map((zone) => ({ zone, where: whereIn(zone) }));
  const cycle = closesACycle({ ...rules, needs, readers });

  write("a new file");
  write("");
  for (const line of homeLines({ homes, needs, readers, cycle })) write(line);
  return 0;
};

const valued = (entry: string): boolean => entry.startsWith(NEEDS) || entry.startsWith(READ_BY);

const refusedIn = (argv: readonly string[], write: (line: string) => void): number | null => {
  const unknown = argv.filter((entry) => entry.startsWith("-") && entry !== UNGOVERNED && !valued(entry));
  if (unknown.length > 0) write(`unrecognised: ${unknown.join(" ")}`);
  else if (argv.some(valued) && !argv.every((entry) => entry.startsWith("-"))) {
    write("a path and the flags answer different questions, so give one or the other");
  } else return null;

  for (const line of USAGE) write(line);
  return EXIT_BAD_USAGE;
};

interface Answer {
  readonly heads: readonly string[];
  readonly body: readonly string[];
  readonly governed: boolean;
}

const targetOf = (cwd: string, entry: string): Target => {
  const [where = "", name] = entry.split("#");
  return { path: resolved(cwd, where), name: name ?? null };
};

const unwrittenIn = (targets: readonly Target[]): Map<string, string> =>
  new Map(targets.filter((target) => target.name === null && !existsSync(target.path)).map((target) => [target.path, ""]));

const answerFor = async (opened: Opened, { path, name }: Target): Promise<Answer> => {
  if (name !== null) return { heads: [], body: await nameLinesFor(opened, path, name), governed: false };

  const ungoverned = ungovernedLinesFor(opened, path);
  return {
    heads: [relative(opened.root, path)],
    body: ungoverned ?? placementLinesFor(opened, path),
    governed: ungoverned === null,
  };
};

const groupedByBody = (answers: readonly Answer[]): readonly Answer[] => {
  const grouped: Answer[] = [];
  const at = new Map<string, number>();
  for (const answer of answers) {
    const key = answer.body.join("\n");
    const index = answer.heads.length === 0 ? undefined : at.get(key);
    const same = index === undefined ? undefined : grouped[index];
    if (index !== undefined && same !== undefined) {
      grouped[index] = { ...same, heads: [...same.heads, ...answer.heads] };
      continue;
    }

    if (answer.heads.length > 0) at.set(key, grouped.length);
    grouped.push(answer);
  }
  return grouped;
};

const explainTargets = async (cwd: string, entries: readonly string[], write: (line: string) => void): Promise<number> => {
  const targets = entries.map((entry) => targetOf(cwd, entry));
  const opened = await openedIn(cwd, write, unwrittenIn(targets));
  if (typeof opened === "number") return opened;

  const answers = await Promise.all(targets.map((target) => answerFor(opened, target)));
  for (const [index, { heads, body }] of groupedByBody(answers).entries()) {
    if (index > 0) write("");
    for (const line of heads.length > 0 ? [...heads, ""] : []) write(line);
    for (const line of body) write(line);
  }

  const named = opened.config.rules.map((rule) => rule.name);
  if (answers.some((answer) => answer.governed) && named.length > 0) {
    write("");
    write(`also runs   ${list(named)}`);
  }

  return 0;
};

export async function runExplain({ cwd, argv, write }: CommandInput): Promise<number> {
  const refused = refusedIn(argv, write);
  if (refused !== null) return refused;

  if (argv.includes(UNGOVERNED)) return ungovernedFor(cwd, write);

  if (argv.some(valued)) {
    const opened = await openedIn(cwd, write);
    return typeof opened === "number" ? opened : homesFrom({ opened, cwd, argv, write });
  }

  if (argv.length === 0) {
    for (const line of USAGE) write(line);
    return EXIT_BAD_USAGE;
  }

  return explainTargets(cwd, argv, write);
}
