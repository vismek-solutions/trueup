import type { Project } from "../../project/model.ts";
import type { Finding } from "../../report/model.ts";
import type { Claim } from "../model.ts";
import { type SymbolReach, acrossZones, alsoReadAtHome, zonesReadingEach } from "./reach.ts";
import { PLACEMENT } from "./remedies.ts";

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

const consumerOf = (group: readonly Reported[], owner: string, project: Project): string => {
  const files = [
    ...new Set(group.flatMap(({ reach }) => [...reach.files])),
  ].filter((file) => project.zoneOf(file) === owner);
  const only = files[0];

  return files.length === 1 && only !== undefined ? project.relative(only) : `${owner} (${files.length} files)`;
};

const listed = (reach: SymbolReach, owner: string, project: Project): readonly string[] => {
  const mine: string[] = [];
  const others: string[] = [];

  for (const [name, files] of reach.through) {
    for (const file of files) {
      if (project.zoneOf(file) !== owner) continue;
      (name === reach.symbol ? mine : others).push(`- ${name} in ${project.relative(file)}`);
    }
  }

  return others.length === 0 ? [] : [...mine.sort(), ...others.sort()];
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

    return group.map((entry) => {
      const said = `${saying(entry, consumerOf([entry], entry.owner, project), kin.has(entry.reach.symbol))}${uncounted(entry.silenced, project)}`;
      const lines = listed(entry.reach, entry.owner, project);

      return {
        severity: "error" as const,
        message: lines.length === 0 ? said : [`${said}:`, ...lines].join("\n"),
        file: entry.reach.declaredIn,
        start: null,
        symbols: [entry.reach.symbol],
        group: entry.reach.declaredIn,
      };
    });
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
