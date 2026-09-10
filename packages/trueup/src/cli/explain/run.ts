import { dirname, isAbsolute, relative, resolve } from "node:path";
import { check, nameIn, placementOf, siblingsIn, ungovernedIn } from "../../compose.ts";
import { resolveInclude } from "../../config/load.ts";
import { DEFAULT_COMMAND } from "../../report/invocation.ts";

import { EXIT_BAD_USAGE, type CommandInput } from "../command.ts";
import { openedIn, unanalysed, type Opened } from "../preamble.ts";
import { closesACycle, homeLines, homesFor, probeFor, type Home } from "./homes.ts";
import { list } from "./lines.ts";
import { nameLines } from "./name.ts";
import { siblingLines } from "./siblings.ts";
import { ungovernedLines } from "./ungoverned.ts";

const UNGOVERNED = "--ungoverned";

const NEEDS = "--needs=";

const READ_BY = "--read-by=";

const USAGE = [
  `usage: ${DEFAULT_COMMAND} explain <path>`,
  `       ${DEFAULT_COMMAND} explain ${NEEDS}<path>[,<path>] [${READ_BY}<path>[,<path>]]`,
];

const SAMPLE = 6;

const sampleOf = (values: Iterable<string>): string => {
  const sorted = [...values].sort();
  const shown = sorted.slice(0, SAMPLE).join(" · ");
  return sorted.length > SAMPLE ? `${shown} · and ${sorted.length - SAMPLE} more` : shown;
};

const ungovernedFor = async (cwd: string, write: (line: string) => void): Promise<number> => {
  const opened = await openedIn(cwd, write);
  if (typeof opened === "number") return opened;

  const { config, project } = opened;
  for (const line of ungovernedLines(ungovernedIn(project, config.boundaries))) write(line);
  return 0;
};

const nameFor = async (cwd: string, target: string, write: (line: string) => void): Promise<number> => {
  const [where = "", name = ""] = target.split("#");
  const path = isAbsolute(where) ? where : resolve(cwd, where);

  const opened = await openedIn(cwd, write);
  if (typeof opened === "number") return opened;

  const { config, root, project, rulebooks } = opened;
  const report = check({
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
      if (finding.symbol !== name || finding.file === null) return [];
      const at = project.relative(finding.file);
      const mine = finding.file === path || readers.has(at);
      return mine ? [`${claim.claim}  ${at}  ${finding.message}`] : [];
    }),
  );

  write(`${relative(root, path)}#${name}`);
  write("");
  for (const line of nameLines({ about, against, command: config.command ?? DEFAULT_COMMAND })) write(line);
  return 0;
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

const pathFor = async (cwd: string, target: string, write: (line: string) => void): Promise<number> => {
  const path = isAbsolute(target) ? target : resolve(cwd, target);
  const opened = await openedIn(cwd, write, new Map([[path, ""]]));
  if (typeof opened === "number") return opened;

  const { config, root, project, rulebooks } = opened;
  const zone = project.zoneOf(path);

  write(relative(root, path));
  write("");

  if (rulebooks.includes(path)) {
    write("zone        none");
    write("            this is a rulebook, so it sits outside the analysis it configures");
    write("            no zone, boundary or seam rule applies to it");
    return 0;
  }

  const missing = unanalysed({ root, config, roots: resolveInclude(root, config.include) }, path);
  if (missing !== null) {
    write(`zone        ${zone ?? "none"}`);
    write("            this path is not analysed, so no claim applies to it");
    write(`            ${missing}`);
    return 0;
  }

  if (zone === null) {
    write("zone        none");
    write("            this path matches no zone, so writing here fails every-file-belongs-to-a-zone");
    write("            put it under an existing zone, or declare one for it");
    return 0;
  }

  const placement = placementOf({ root, path, zones: config.zones, boundaries: config.boundaries });

  write(`zone        ${zone}`);
  write(`may reach   ${list(placement.mayReach)}`);
  write(`may not     ${list(placement.mayNotReach)}`);

  const siblings = siblingLines(siblingsIn({ rules: config.isolate ?? [], root, project, path }));
  if (siblings.length > 0) {
    write("");
    for (const line of siblings) write(line);
  }

  for (const seam of config.seams.filter((rule) => rule.generic === zone)) {
    const vocabulary = project.vocabularyOf(seam.domain);
    write("");
    write(`vocabulary  ${list([...seam.domain])} owns names this file may not use:`);
    write(`            ${sampleOf(vocabulary.names)}`);
    write(`            and values it may not repeat:`);
    write(`            ${sampleOf(vocabulary.literals)}`);
  }

  const named = config.rules.map((rule) => rule.name);
  if (named.length > 0) {
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

  const target = argv[0];
  if (target === undefined) {
    for (const line of USAGE) write(line);
    return 3;
  }

  return target.includes("#") ? nameFor(cwd, target, write) : pathFor(cwd, target, write);
}
