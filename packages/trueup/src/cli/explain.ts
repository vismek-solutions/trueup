import { isAbsolute, relative, resolve } from "node:path";
import { placementOf } from "../compose.ts";
import { DEFAULT_COMMAND } from "../report/invocation.ts";

import { EXIT_BAD_USAGE, type CommandInput } from "./command.ts";
import { openedIn } from "./preamble.ts";

const SAMPLE = 6;

const list = (values: readonly string[]): string => (values.length === 0 ? "none" : values.join(" · "));

const sampleOf = (values: Iterable<string>): string => {
  const sorted = [...values].sort();
  const shown = sorted.slice(0, SAMPLE).join(" · ");
  return sorted.length > SAMPLE ? `${shown} · and ${sorted.length - SAMPLE} more` : shown;
};

export async function runExplain({ cwd, argv, write }: CommandInput): Promise<number> {
  const flags = argv.filter((entry) => entry.startsWith("-"));
  if (flags.length > 0) {
    write(`unrecognised: ${flags.join(" ")}`);
    write(`usage: ${DEFAULT_COMMAND} explain <path>`);
    return EXIT_BAD_USAGE;
  }

  const target = argv[0];
  if (target === undefined) {
    write(`usage: ${DEFAULT_COMMAND} explain <path>`);
    return 3;
  }

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

  if (zone === null) {
    write("zone        none");
    write("            this path matches no zone, so writing here fails every-file-belongs-to-a-zone");
    write("            put it under an existing zone, or declare one for it");
    return 0;
  }

  const placement = placementOf({ root, path, zones: config.zones, boundaries: config.boundaries ?? [] });

  write(`zone        ${zone}`);
  write(`may reach   ${list(placement.mayReach)}`);
  write(`may not     ${list(placement.mayNotReach)}`);

  for (const seam of (config.seams ?? []).filter((rule) => rule.generic === zone)) {
    const vocabulary = project.vocabularyOf(seam.domain);
    write("");
    write(`vocabulary  ${list([...seam.domain])} owns names this file may not use:`);
    write(`            ${sampleOf(vocabulary.names)}`);
    write(`            and values it may not repeat:`);
    write(`            ${sampleOf(vocabulary.literals)}`);
  }

  const named = (config.rules ?? []).map((rule) => rule.name);
  if (named.length > 0) {
    write("");
    write(`also runs   ${list(named)}`);
  }

  return 0;
}
