import { placementOf, siblingsIn } from "../../main.ts";
import { resolveInclude } from "../../config/load.ts";

import { readAsAsset, unanalysed, type Opened } from "../preamble.ts";
import { listed, tagged } from "../tags.ts";
import { treeLines } from "./lines.ts";
import { siblingLines } from "./siblings.ts";

const SAMPLE = 6;

const sampleOf = (values: Iterable<string>): readonly string[] => {
  const sorted = [...values].sort();
  const shown = sorted.slice(0, SAMPLE);
  return sorted.length > SAMPLE ? [...shown, `and ${sorted.length - SAMPLE} more`] : shown;
};

const unplacedLines = (zone: string, why: string, said: readonly string[]): readonly string[] => [
  ...tagged("zone", zone),
  ...tagged(why, said),
];

export const ungovernedLinesFor = (opened: Opened, path: string): readonly string[] | null => {
  const { config, root, project, rulebooks } = opened;

  if (rulebooks.includes(path)) {
    return unplacedLines("none", "rulebook", [
      "this is a rulebook, so it sits outside the analysis it configures",
      "no zone, boundary or seam rule applies to it",
    ]);
  }

  const site = { root, config, roots: resolveInclude(root, config.include) };

  if (readAsAsset(site, path)) {
    return unplacedLines("none", "asset", [
      "this is an asset, so it is read as text and never parsed",
      "no zone, boundary or seam rule reaches it, and a rule may read what it says",
    ]);
  }

  const missing = unanalysed(site, path);
  if (missing !== null) {
    return unplacedLines(project.zoneOf(path) ?? "none", "not-analysed", [
      "this path is not analysed, so no claim applies to it",
      missing,
    ]);
  }

  if (project.zoneOf(path) === null) {
    return unplacedLines("none", "no-zone", [
      "this path matches no zone, so writing here fails every-file-belongs-to-a-zone",
      "put it under an existing zone, or declare one for it",
    ]);
  }

  return null;
};

export const placementLinesFor = (opened: Opened, path: string): readonly string[] => {
  const { config, root, project } = opened;
  const zone = project.zoneOf(path);
  const placement = placementOf({ root, path, zones: config.zones, boundaries: config.boundaries });

  const vocabulary = config.seams
    .filter((rule) => rule.generic === zone)
    .flatMap((seam) => {
      const owner = { owner: seam.domain.join(", ") };
      const { names, literals } = project.vocabularyOf(seam.domain);
      return [...listed("may-not-name", sampleOf(names), owner), ...listed("may-not-repeat", sampleOf(literals), owner)];
    });

  return [
    ...tagged("zone", zone ?? "none"),
    ...tagged("may-reach", treeLines(placement.mayReach)),
    ...siblingLines(siblingsIn({ rules: config.isolate ?? [], root, project, path })),
    ...vocabulary,
  ];
};
