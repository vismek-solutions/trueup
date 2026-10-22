import { reachOf } from "../../main.ts";
import type { ResolvedConfig } from "../../config/model.ts";
import { plural } from "../render.ts";
import { items, tagged } from "../tags.ts";

type Zone = ResolvedConfig["zones"][number];

export interface Zoned {
  readonly filesIn: (zone: string) => readonly string[];
}

const FEW = 4;

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

const rowsFor = (run: Run, directory: string, project: Zoned): readonly string[] =>
  items(
    run.zones.map((zone) => {
      const held = plural(project.filesIn(zone.name).length, "file");
      const marks = [zone.role, zone.shared === true ? "shared" : undefined].filter((mark) => mark !== undefined);
      const said = marks.length === 0 ? "" : ` (${marks.join(", ")})`;
      const shown = zone.patterns.map((one) => (directory === "" ? one : one.slice(directory.length + 1)));
      return `${zone.name}, ${held}, ${shown.join(", ")}${said}`;
    }),
  );

export const zoneLines = (config: ResolvedConfig, project: Zoned): readonly string[] =>
  runsOf(config.zones).flatMap((run) => {
    const directory = directoryOf(run);
    const rows = rowsFor(run, directory, project);
    return directory === "" ? rows : tagged("package", rows, { path: directory });
  });

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

interface Reach {
  readonly from: string;
  readonly named: readonly string[];
  readonly others: readonly string[];
  readonly ruled: boolean;
}

const reachRow = ({ from, named, others, ruled }: Reach): readonly string[] => {
  const attributes = { from };
  if (named.length === 0) return tagged("reach", "nothing", attributes);
  if (named.length === others.length) {
    return tagged("reach", ruled ? "every other zone" : "every other zone, since no rule constrains it", attributes);
  }

  const grouped = byGroup(named, wholeGroups(named, others));
  const closed = others.filter((name) => !named.includes(name));
  return grouped.length > FEW && closed.length < grouped.length
    ? tagged("reach-all-except", items(closed), attributes)
    : tagged("reach", items(grouped), attributes);
};

export const reachLines = (config: ResolvedConfig): readonly string[] => {
  const boundaries = config.boundaries;
  if (boundaries.length === 0) return [];

  const names = config.zones.map((zone) => zone.name);
  const ruled = new Set(boundaries.map((rule) => rule.from));

  return config.zones.flatMap((zone) => {
    const { mayReach } = reachOf({ zone: zone.name, zones: config.zones, boundaries });
    return reachRow({
      from: zone.name,
      named: mayReach.filter((name) => name !== zone.name),
      others: names.filter((name) => name !== zone.name),
      ruled: ruled.has(zone.name),
    });
  });
};
