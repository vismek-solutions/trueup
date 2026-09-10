import { basename, dirname, join } from "node:path";
import { reachOf, type ReachInput } from "../../compose.ts";
import { list } from "./lines.ts";

export type Rulebook = Omit<ReachInput, "zone">;

export interface HomesInput extends Rulebook {
  readonly needs: readonly string[];
  readonly readers: readonly string[];
}

export interface Home {
  readonly zone: string;
  readonly where: string | null;
}

const reachedBy = (rules: Rulebook, zone: string): readonly string[] => reachOf({ ...rules, zone }).mayReach;

export const homesFor = ({ needs, readers, ...rules }: HomesInput): readonly string[] =>
  rules.zones
    .map((zone) => zone.name)
    .filter((name) => needs.every((need) => reachedBy(rules, name).includes(need)))
    .filter((name) => readers.every((reader) => reachedBy(rules, reader).includes(name)));

const closureOf = (rules: Rulebook, from: readonly string[]): ReadonlySet<string> => {
  const seen = new Set(from);
  let growing = true;

  while (growing) {
    growing = false;
    for (const zone of [...seen]) {
      for (const next of reachedBy(rules, zone)) {
        if (seen.has(next)) continue;
        seen.add(next);
        growing = true;
      }
    }
  }

  return seen;
};

export const closesACycle = ({ needs, readers, ...rules }: HomesInput): boolean => {
  const reached = closureOf(rules, needs);
  return readers.some((reader) => reached.has(reader));
};

const shallowest = (files: readonly string[]): string | undefined =>
  [...files].sort((left, right) => dirname(left).length - dirname(right).length)[0];

export const probeFor = (files: readonly string[]): string | null => {
  const file = shallowest(files);
  if (file === undefined) return null;

  const name = basename(file);
  const dot = name.indexOf(".");
  return join(dirname(file), dot === -1 ? "probe" : `probe${name.slice(dot)}`);
};

const WIDTH = 12;

const labelled = (label: string, value: string): string => `${label.padEnd(WIDTH)}${value}`;

const placed = (homes: readonly Home[]): readonly string[] => {
  const column = Math.max(...homes.map((home) => home.zone.length)) + 2;

  return homes.map((home, at) =>
    labelled(
      at === 0 ? "may live" : "",
      home.where === null ? home.zone : `${home.zone.padEnd(column)}${home.where}`,
    ),
  );
};

export interface DeadEndInput {
  readonly needs: readonly string[];
  readonly readers: readonly string[];
  readonly cycle: boolean;
}

const deadEnd = ({ needs, readers, cycle }: DeadEndInput): readonly string[] => {
  const indent = " ".repeat(WIDTH);
  if (!cycle) {
    return [
      `${indent}No zone may reach ${list(needs)} at once, and a zone that may would close no`,
      `${indent}cycle. Declare one, named for what it holds rather than for being shared.`,
    ];
  }

  return [
    `${indent}A zone reaching ${list(needs)} and read by ${list(readers)} would close a cycle,`,
    `${indent}because ${list(needs)} already reaches ${list(readers)}. This is two files rather`,
    `${indent}than one: split it along the zones it reaches.`,
  ];
};

export interface HomeLinesInput extends DeadEndInput {
  readonly homes: readonly Home[];
}

export const homeLines = ({ homes, needs, readers, cycle }: HomeLinesInput): readonly string[] => [
  labelled("reaches", list([...needs])),
  labelled("read by", readers.length === 0 ? "nothing yet" : list([...readers])),
  "",
  ...(homes.length > 0 ? placed(homes) : [labelled("may live", "nowhere"), ...deadEnd({ needs, readers, cycle })]),
];
