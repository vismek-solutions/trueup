import { isAbsolute, relative, resolve } from "node:path";
import { check, nameIn, placementOf, ungovernedIn } from "../../compose.ts";
import { resolveInclude } from "../../config/load.ts";
import { DEFAULT_COMMAND } from "../../report/invocation.ts";

import { EXIT_BAD_USAGE, type CommandInput } from "../command.ts";
import { openedIn, unanalysed } from "../preamble.ts";
import { list } from "./lines.ts";
import { nameLines } from "./name.ts";
import { ungovernedLines } from "./ungoverned.ts";

const UNGOVERNED = "--ungoverned";

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
  for (const line of nameLines({ about, against })) write(line);
  return 0;
};

export async function runExplain({ cwd, argv, write }: CommandInput): Promise<number> {
  const flags = argv.filter((entry) => entry.startsWith("-") && entry !== UNGOVERNED);
  if (flags.length > 0) {
    write(`unrecognised: ${flags.join(" ")}`);
    write(`usage: ${DEFAULT_COMMAND} explain <path>`);
    return EXIT_BAD_USAGE;
  }

  if (argv.includes(UNGOVERNED)) return ungovernedFor(cwd, write);

  const target = argv[0];
  if (target === undefined) {
    write(`usage: ${DEFAULT_COMMAND} explain <path>`);
    return 3;
  }

  if (target.includes("#")) return nameFor(cwd, target, write);

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
}
