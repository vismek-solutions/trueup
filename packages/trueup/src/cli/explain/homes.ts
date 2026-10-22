import { basename, dirname, join } from "node:path";
import { reachOf, type HomesInput, type Rulebook } from "../../main.ts";
import { items, listed, tagged } from "../tags.ts";
import { spoken } from "./lines.ts";

export interface Home {
  readonly zone: string;
  readonly where: string | null;
}

const reachedBy = (rules: Rulebook, zone: string): readonly string[] => reachOf({ ...rules, zone }).mayReach;

const closureOf = (rules: Rulebook, from: readonly string[]): ReadonlySet<string> => {
  const seen = new Set(from);
  const pending = Array.from(seen);

  for (let zone = pending.pop(); zone !== undefined; zone = pending.pop()) {
    for (const next of reachedBy(rules, zone)) {
      if (seen.has(next)) continue;
      seen.add(next);
      pending.push(next);
    }
  }

  return seen;
};

export const closesACycle = ({ needs, readers, ...rules }: HomesInput): boolean => {
  const reached = closureOf(rules, needs);
  return readers.some((reader) => reached.has(reader));
};

const shallowest = (files: readonly string[]): string | undefined => {
  let nearest: string | undefined;

  for (const file of files) {
    if (nearest === undefined || dirname(file).length < dirname(nearest).length) nearest = file;
  }

  return nearest;
};

export const probeFor = (files: readonly string[]): string | null => {
  const file = shallowest(files);
  if (file === undefined) return null;

  const name = basename(file);
  return join(dirname(file), `probe${name.slice(name.indexOf("."))}`);
};

const placed = (home: Home): string => (home.where === null ? home.zone : `${home.zone}, at ${home.where}`);

export interface DeadEndInput {
  readonly needs: readonly string[];
  readonly readers: readonly string[];
  readonly cycle: boolean;
}

const deadEnd = ({ needs, readers, cycle }: DeadEndInput): readonly string[] => {
  if (!cycle) {
    return [
      `no zone may reach ${spoken(needs)} at once, and a zone that may would close no cycle`,
      "declare one, named for what it holds rather than for being shared",
    ];
  }

  return [
    `a zone reaching ${spoken(needs)} and read by ${spoken(readers)} would close a cycle, because ${spoken(needs)} already reaches ${spoken(readers)}`,
    "this is two files rather than one: split it along the zones it reaches",
  ];
};

export interface HomeLinesInput extends DeadEndInput {
  readonly homes: readonly Home[];
}

export const homeLines = ({ homes, needs, readers, cycle }: HomeLinesInput): readonly string[] =>
  tagged("new-file", [
    ...listed("reaches", needs),
    ...listed("read-by", readers),
    ...tagged("may-live", homes.length > 0 ? items(homes.map(placed)) : ["nowhere", ...deadEnd({ needs, readers, cycle })]),
  ]);
