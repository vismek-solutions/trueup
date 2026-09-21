import { reachOf } from "../../main.ts";
import type { ResolvedConfig } from "../../config/model.ts";
import { plural } from "../render.ts";

type Zone = ResolvedConfig["zones"][number];

export interface Zoned {
  readonly filesIn: (zone: string) => readonly string[];
}

const TALLY = 9;
const FEW = 4;

export const listed = (names: readonly string[]): string =>
  names.length === 0 ? "nothing" : names.join(" · ");

const groupOf = (zone: string): string | null => {
  const cut = zone.indexOf("/");
  return cut === -1 ? null : zone.slice(0, cut);
};

interface Run {
  readonly group: string | null;
  readonly zones: Zone[];
}

const runsOf = (zones: readonly Zone[]): readonly Run[] => {
  const runs: Run[] = [];

  for (const zone of zones) {
    const group = groupOf(zone.name);
    const last = runs.at(-1);
    if (group !== null && last?.group === group) last.zones.push(zone);
    else runs.push({ group, zones: [zone] });
  }

  return runs;
};

const GLOB = /[*?[\]{}]/;

const sharedPath = (patterns: readonly string[]): string => {
  const parts = patterns.map((pattern) => pattern.split("/"));
  const taken: string[] = [];

  for (const [index, segment] of (parts[0] ?? []).entries()) {
    const shared = parts.every((one) => one[index] === segment && one.length > index + 1);
    if (GLOB.test(segment) || !shared) break;
    taken.push(segment);
  }

  return taken.join("/");
};

const directoryOf = (run: Run): string => {
  if (run.zones.length < 2 || run.group === null) return "";

  const path = sharedPath(run.zones.flatMap((zone) => zone.patterns));
  return path === run.group || path.endsWith(`/${run.group}`) ? path : "";
};

interface Placed {
  readonly run: Run;
  readonly directory: string;
}

const linesFor = (place: Placed, width: number, project: Zoned): readonly string[] => {
  const { directory } = place;
  const indent = directory === "" ? "  " : "    ";
  const column = directory === "" ? width : width - 2;

  return place.run.zones.map((zone) => {
    const held = plural(project.filesIn(zone.name).length, "file").padStart(TALLY);
    const marks = [zone.role, zone.shared === true ? "shared" : undefined].filter((mark) => mark !== undefined);
    const said = marks.length === 0 ? "" : `  (${marks.join(", ")})`;
    const shown = zone.patterns.map((one) => (directory === "" ? one : one.slice(directory.length + 1)));
    return `${indent}${zone.name.padEnd(column)}  ${held}  ${shown.join(" · ")}${said}`;
  });
};

export const zoneLines = (config: ResolvedConfig, project: Zoned): readonly string[] => {
  const placed = runsOf(config.zones).map((run) => ({ run, directory: directoryOf(run) }));
  const width = Math.max(
    ...placed.flatMap((place) =>
      place.run.zones.map((zone) => zone.name.length + (place.directory === "" ? 0 : 2)),
    ),
  );

  return placed.flatMap((place) => [
    ...(place.directory === "" ? [] : [`  ${place.directory}`]),
    ...linesFor(place, width, project),
  ]);
};

const pairName = ([name]: readonly [string, number]): string => name;

const wholeGroups = (named: readonly string[], others: readonly string[]): ReadonlySet<string> => {
  const held = new Map<string, number>();
  const taken = new Map<string, number>();

  for (const zone of others) {
    const group = groupOf(zone);
    if (group === null) continue;
    held.set(group, (held.get(group) ?? 0) + 1);
    if (named.includes(zone)) taken.set(group, (taken.get(group) ?? 0) + 1);
  }

  return new Set([...held].filter(([group, count]) => count > 1 && taken.get(group) === count).map(pairName));
};

const byGroup = (named: readonly string[], whole: ReadonlySet<string>): readonly string[] => {
  const said = new Set<string>();

  return named.flatMap((zone) => {
    const group = groupOf(zone);
    if (group === null || !whole.has(group)) return [zone];
    if (said.has(group)) return [];
    said.add(group);
    return [`${group}/*`];
  });
};

const everything = (ruled: boolean): string =>
  ruled ? "every other zone" : "every other zone, since no rule constrains it";

const reachedBy = (named: readonly string[], others: readonly string[], ruled: boolean): string => {
  if (named.length === 0) return "nothing";
  if (named.length === others.length) return everything(ruled);

  const grouped = byGroup(named, wholeGroups(named, others));
  const closed = others.filter((name) => !named.includes(name));
  return grouped.length > FEW && closed.length < grouped.length
    ? `every other zone except ${listed(closed)}`
    : listed(grouped);
};

export const reachLines = (config: ResolvedConfig): readonly string[] => {
  const boundaries = config.boundaries;
  if (boundaries.length === 0) return [];

  const names = config.zones.map((zone) => zone.name);
  const width = Math.max(...names.map((name) => name.length));
  const ruled = new Set(boundaries.map((rule) => rule.from));

  return config.zones.map((zone) => {
    const { mayReach } = reachOf({ zone: zone.name, zones: config.zones, boundaries });
    const named = mayReach.filter((name) => name !== zone.name);
    const others = names.filter((name) => name !== zone.name);
    return `  ${zone.name.padEnd(width)} → ${reachedBy(named, others, ruled.has(zone.name))}`;
  });
};
