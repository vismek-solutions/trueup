import type { Project, ResolvedImport } from "../../project/model.ts";
import type { Finding } from "../../report/model.ts";
import type { Claim } from "../model.ts";
import { PLACEMENT } from "./remedies.ts";

type Crossing = ResolvedImport & {
  readonly symbol: string;
  readonly declaredIn: string;
  readonly fromZone: string;
  readonly declaredZone: string;
};

export interface SymbolReach {
  readonly declaredIn: string;
  readonly declaredZone: string;
  readonly symbol: string;
  readonly zones: Set<string>;
  readonly files: Set<string>;
}

const named = (edge: ResolvedImport): edge is Crossing => {
  if (edge.symbol === null || edge.declaredIn === null) return false;
  return edge.fromZone !== null && edge.declaredZone !== null;
};

const usable = (edge: ResolvedImport): edge is Crossing => edge.kind !== "type" && named(edge);

const gather = (imports: readonly ResolvedImport[], keepSameZone: boolean): SymbolReach[] => {
  const seen = new Map<string, SymbolReach>();

  for (const edge of imports) {
    if (!usable(edge)) continue;
    if (!keepSameZone && edge.fromZone === edge.declaredZone) continue;

    const key = `${edge.declaredIn}\0${edge.symbol}`;
    const found = seen.get(key);
    if (found === undefined) {
      seen.set(key, {
        declaredIn: edge.declaredIn,
        declaredZone: edge.declaredZone,
        symbol: edge.symbol,
        zones: new Set([edge.fromZone]),
        files: new Set([edge.from]),
      });
    } else {
      found.zones.add(edge.fromZone);
      found.files.add(edge.from);
    }
  }

  return [...seen.values()].sort((left, right) => (left.declaredIn < right.declaredIn ? -1 : 1));
};

const builtFrom = (project: Project): ((file: string, name: string) => readonly string[]) => {
  const cached = new Map<string, readonly string[]>();

  return (file, name) => {
    const key = `${file}\0${name}`;
    const found = cached.get(key);
    if (found !== undefined) return found;

    const reached = project.reachedWithin(file, [name]);
    cached.set(key, reached);

    return reached;
  };
};

const alsoThroughTypes = (project: Project, reaches: readonly SymbolReach[]): readonly SymbolReach[] => {
  const standing = new Map(reaches.map((reach) => [`${reach.declaredIn}\0${reach.symbol}`, reach]));
  const namesFrom = builtFrom(project);

  for (const edge of project.imports()) {
    if (edge.kind !== "type" || !named(edge) || edge.fromZone === edge.declaredZone) continue;

    for (const name of namesFrom(edge.declaredIn, edge.symbol)) {
      const reach = standing.get(`${edge.declaredIn}\0${name}`);
      reach?.zones.add(edge.fromZone);
      reach?.files.add(edge.from);
    }
  }

  return reaches;
};

const acrossZones = (project: Project): readonly SymbolReach[] =>
  alsoThroughTypes(project, gather(project.imports(), false));

export const everyConsumer = (imports: readonly ResolvedImport[]): SymbolReach[] => gather(imports, true);

interface Reported {
  readonly reach: SymbolReach;
  readonly owner: string;
  readonly atHome: boolean;
  readonly silenced: readonly string[];
}

const reportedIn = (project: Project, roles: ReadonlySet<string>): readonly Reported[] => {
  const home = alsoReadAtHome(project);

  return acrossZones(project).flatMap((reach) => {
    const owners = [...reach.zones].filter((zone) => !roles.has(zone));
    const only = owners[0];
    if (owners.length !== 1 || only === undefined) return [];

    const silenced = [...reach.zones].filter((zone) => roles.has(zone)).sort();
    return [{ reach, owner: only, atHome: home.has(`${reach.declaredIn}\0${reach.symbol}`), silenced }];
  });
};

const byFile = (reported: readonly Reported[]): [string, Reported[]][] => {
  const groups = new Map<string, Reported[]>();

  for (const entry of reported) {
    const found = groups.get(entry.reach.declaredIn);
    if (found === undefined) groups.set(entry.reach.declaredIn, [entry]);
    else found.push(entry);
  }

  return [...groups];
};

const zonesReadingEach = (project: Project, roles: ReadonlySet<string>): Map<string, Set<string>> => {
  const readers = new Map<string, Set<string>>();

  for (const edge of project.imports()) {
    if (!named(edge) || roles.has(edge.fromZone)) continue;

    const zones = readers.get(edge.declaredIn) ?? new Set<string>();
    zones.add(edge.fromZone);
    readers.set(edge.declaredIn, zones);
  }

  return readers;
};

const alsoReadAtHome = (project: Project): ReadonlySet<string> => {
  const keys = new Set<string>();

  for (const edge of project.imports()) {
    if (!usable(edge) || edge.fromZone !== edge.declaredZone || edge.from === edge.declaredIn) continue;
    keys.add(`${edge.declaredIn}\0${edge.symbol}`);
  }

  return keys;
};

const consumerOf = (group: readonly Reported[], owner: string, project: Project): string => {
  const files = [
    ...new Set(group.flatMap(({ reach }) => [...reach.files])),
  ].filter((file) => project.zoneOf(file) === owner);
  const only = files[0];

  return files.length === 1 && only !== undefined ? project.relative(only) : `${owner} (${files.length} files)`;
};

const readWithin = (project: Project, file: string): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const used of project.referencesIn(file).values()) for (const name of used) names.add(name);

  return names;
};

const alsoBy = (atZone: boolean, atFile: boolean): string => {
  if (atZone && atFile) return "inside its zone and by this file as well";
  return atZone ? "inside its zone as well" : "by this file as well";
};

const saying = ({ reach, atHome }: Reported, where: string, atFile: boolean): string => {
  if (!atHome && !atFile) return `declares ${reach.symbol}, used only by ${where}`;

  const lead = atHome ? `used outside its zone only by ${where}` : `used only by ${where}`;
  return `declares ${reach.symbol}, ${lead}, and ${alsoBy(atHome, atFile)}`;
};

const uncounted = (silenced: readonly string[], project: Project): string => {
  const only = silenced[0];
  if (only === undefined) return "";
  if (silenced.length === 1) {
    return `, while ${only} reads it too but is ${project.roleOf(only)}, so it does not count`;
  }

  return `, while ${silenced.join(", ")} read it too but wear roles, so they do not count`;
};

const misplaced = (
  group: readonly Reported[],
  project: Project,
  readBy: ReadonlySet<string>,
): readonly Finding[] => {
  const first = group[0];
  if (first === undefined) return [];

  const owners = new Set(group.map(({ owner }) => owner));
  const wholeFile = owners.size === 1 && readBy.size === 1 && readBy.has(first.owner);
  if (group.length === 1 || !wholeFile) {
    const kin = readWithin(project, first.reach.declaredIn);

    return group.map((entry) => ({
      severity: "error" as const,
      message: `${saying(entry, consumerOf([entry], entry.owner, project), kin.has(entry.reach.symbol))}${uncounted(entry.silenced, project)}`,
      file: entry.reach.declaredIn,
      start: null,
      symbols: [entry.reach.symbol],
      group: entry.reach.declaredIn,
    }));
  }

  const where = consumerOf(group, first.owner, project);
  const silenced = [...new Set(group.flatMap((entry) => entry.silenced))].sort();

  return [
    {
      severity: "error" as const,
      message: `declares ${group.length} exports, all used only by ${where}, so the file is in the wrong directory rather than the declarations${uncounted(silenced, project)}`,
      file: first.reach.declaredIn,
      start: null,
      symbols: group.map(({ reach }) => reach.symbol).sort(),
      group: first.reach.declaredIn,
    },
  ];
};

export function colocationClaim(roleZones: readonly string[]): Claim {
  const roles = new Set(roleZones);

  return {
    name: "no-value-is-declared-away-from-its-only-consumer",
    guidance: PLACEMENT,
    check: ({ project }): readonly Finding[] => {
      const readBy = zonesReadingEach(project, roles);

      return byFile(reportedIn(project, roles)).flatMap(([file, group]) =>
        misplaced(group, project, readBy.get(file) ?? new Set()),
      );
    },
  };
}
