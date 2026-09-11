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

const usable = (edge: ResolvedImport): edge is Crossing => {
  if (edge.kind === "type" || edge.symbol === null || edge.declaredIn === null) return false;
  return edge.fromZone !== null && edge.declaredZone !== null;
};

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

const acrossZones = (imports: readonly ResolvedImport[]): SymbolReach[] => gather(imports, false);

export const everyConsumer = (imports: readonly ResolvedImport[]): SymbolReach[] => gather(imports, true);

interface Reported {
  readonly reach: SymbolReach;
  readonly owner: string;
  readonly atHome: boolean;
}

const reportedIn = (project: Project, roles: ReadonlySet<string>): readonly Reported[] => {
  const home = alsoReadAtHome(project);

  return acrossZones(project.imports()).flatMap((reach) => {
    const owners = [...reach.zones].filter((zone) => !roles.has(zone));
    const only = owners[0];
    if (owners.length !== 1 || only === undefined) return [];
    return [{ reach, owner: only, atHome: home.has(`${reach.declaredIn}\0${reach.symbol}`) }];
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

  for (const reach of everyConsumer(project.imports())) {
    const zones = readers.get(reach.declaredIn) ?? new Set<string>();
    for (const zone of reach.zones) if (!roles.has(zone)) zones.add(zone);
    readers.set(reach.declaredIn, zones);
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
      message: saying(entry, consumerOf([entry], entry.owner, project), kin.has(entry.reach.symbol)),
      file: entry.reach.declaredIn,
      start: null,
      symbols: [entry.reach.symbol],
      group: entry.reach.declaredIn,
    }));
  }

  const where = consumerOf(group, first.owner, project);
  return [
    {
      severity: "error" as const,
      message: `declares ${group.length} exports, all used only by ${where}, so the file is in the wrong directory rather than the declarations`,
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
