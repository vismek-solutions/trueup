import { placementOf, siblingsIn } from "../../main.ts";
import { resolveInclude } from "../../config/load.ts";

import { readAsAsset, unanalysed, type Opened } from "../preamble.ts";
import { list } from "./lines.ts";
import { siblingLines } from "./siblings.ts";

const SAMPLE = 6;

const sampleOf = (values: Iterable<string>): string => {
  const sorted = [...values].sort();
  const shown = sorted.slice(0, SAMPLE).join(" · ");
  return sorted.length > SAMPLE ? `${shown} · and ${sorted.length - SAMPLE} more` : shown;
};

export const ungovernedLinesFor = (opened: Opened, path: string): readonly string[] | null => {
  const { config, root, project, rulebooks } = opened;

  if (rulebooks.includes(path)) {
    return [
      "zone        none",
      "            this is a rulebook, so it sits outside the analysis it configures",
      "            no zone, boundary or seam rule applies to it",
    ];
  }

  const site = { root, config, roots: resolveInclude(root, config.include) };

  if (readAsAsset(site, path)) {
    return [
      "zone        none",
      "            this is an asset, so it is read as text and never parsed",
      "            no zone, boundary or seam rule reaches it, and a rule may read what it says",
    ];
  }

  const missing = unanalysed(site, path);
  if (missing !== null) {
    return [
      `zone        ${project.zoneOf(path) ?? "none"}`,
      "            this path is not analysed, so no claim applies to it",
      `            ${missing}`,
    ];
  }

  if (project.zoneOf(path) === null) {
    return [
      "zone        none",
      "            this path matches no zone, so writing here fails every-file-belongs-to-a-zone",
      "            put it under an existing zone, or declare one for it",
    ];
  }

  return null;
};

export const placementLinesFor = (opened: Opened, path: string): readonly string[] => {
  const { config, root, project } = opened;
  const zone = project.zoneOf(path);
  const placement = placementOf({ root, path, zones: config.zones, boundaries: config.boundaries });
  const lines = [`zone        ${zone}`, `may reach   ${list(placement.mayReach)}`, `may not     ${list(placement.mayNotReach)}`];

  const siblings = siblingLines(siblingsIn({ rules: config.isolate ?? [], root, project, path }));
  if (siblings.length > 0) lines.push("", ...siblings);

  for (const seam of config.seams.filter((rule) => rule.generic === zone)) {
    const vocabulary = project.vocabularyOf(seam.domain);
    lines.push(
      "",
      `vocabulary  ${list([...seam.domain])} owns names this file may not use:`,
      `            ${sampleOf(vocabulary.names)}`,
      `            and values it may not repeat:`,
      `            ${sampleOf(vocabulary.literals)}`,
    );
  }

  return lines;
};
