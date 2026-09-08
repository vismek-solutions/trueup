import { isAbsolute, relative, resolve } from "node:path";
import { inspect, placementOf } from "../compose.ts";
import { findConfig, loadConfig, resolveInclude } from "../config/load.ts";
import { DEFAULT_COMMAND } from "../report/invocation.ts";

import type { CommandInput } from "./command.ts";
import { EXIT_BAD_USAGE } from "./main.ts";

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

  const configPath = findConfig(cwd);
  if (configPath === null) {
    write("no trueline.config.ts found");
    return 3;
  }

  const { config, root, memberConfigs } = await loadConfig(configPath);
  const rulebooks = [configPath, ...memberConfigs];
  const path = isAbsolute(target) ? target : resolve(cwd, target);

  const project = inspect({
    root,
    roots: resolveInclude(root, config.include),
    zones: config.zones,
    extensions: config.extensions,
    externals: config.externals,
    ignoreDirectories: config.ignoreDirectories,
    ignoreFiles: rulebooks,
    overlay: new Map([[path, ""]]),
  });

  const zone = project.zoneOf(path);

  write(relative(root, path));
  write("");

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
