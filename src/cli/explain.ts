import { isAbsolute, relative, resolve } from "node:path";
import { inspect, placementOf } from "../compose.ts";
import { findConfig, loadConfig, resolveInclude } from "../config/load.ts";
import { DEFAULT_COMMAND } from "../report/invocation.ts";

export interface RunExplainInput {
  readonly cwd: string;
  readonly argv: readonly string[];
  readonly write: (line: string) => void;
}

const SAMPLE = 6;

const list = (values: readonly string[]): string => (values.length === 0 ? "none" : values.join(" · "));

const sampleOf = (values: Iterable<string>): string => {
  const sorted = [...values].sort();
  const shown = sorted.slice(0, SAMPLE).join(" · ");
  return sorted.length > SAMPLE ? `${shown} · and ${sorted.length - SAMPLE} more` : shown;
};

export async function runExplain({ cwd, argv, write }: RunExplainInput): Promise<number> {
  const target = argv.find((entry) => !entry.startsWith("--"));
  if (target === undefined) {
    write(`usage: ${DEFAULT_COMMAND} explain <path>`);
    return 3;
  }

  const configPath = findConfig(cwd);
  if (configPath === null) {
    write("no architecture.config.ts found");
    return 3;
  }

  const { config, root } = await loadConfig(configPath);
  const path = isAbsolute(target) ? target : resolve(cwd, target);

  const project = inspect({
    root,
    roots: resolveInclude(root, config.include),
    zones: config.zones,
    extensions: config.extensions,
    ignoreDirectories: config.ignoreDirectories,
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
