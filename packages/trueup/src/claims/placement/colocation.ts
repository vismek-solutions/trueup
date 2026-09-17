import type { Project } from "../../project/model.ts";
import type { Finding } from "../../report/model.ts";
import type { ZoneDefinition } from "../../zones/model.ts";
import { partReader } from "../isolation/groups.ts";
import type { Claim } from "../model.ts";
import { type SymbolReach, type UnitOf, acrossZones, alsoReadAtHome, unitsReadingEach } from "./reach.ts";
import { type PlacementShape, placementGuidance } from "./remedies.ts";

interface Reported {
  readonly reach: SymbolReach;
  readonly owner: string;
  readonly unit: string;
  readonly partwise: boolean;
  readonly atHome: boolean;
  readonly silenced: readonly string[];
}

interface Counting {
  readonly roles: ReadonlySet<string>;
  readonly shared: ReadonlySet<string>;
  readonly unitOf: UnitOf;
}

const reportedIn = (project: Project, { roles, shared, unitOf }: Counting): readonly Reported[] => {
  const home = alsoReadAtHome(project);

  return acrossZones(project).flatMap((reach) => {
    const owners = [...reach.zones].filter((zone) => !roles.has(zone));
    const only = owners[0];
    if (owners.length !== 1 || only === undefined) return [];

    const counted = [...reach.files].filter((file) => !roles.has(project.zoneOf(file) ?? ""));
    const units = new Set(counted.map((file) => unitOf(reach.declaredIn, file)));
    const unit = [...units][0];
    if (units.size !== 1 || unit === undefined) return [];

    const silenced = [...reach.zones].filter((zone) => roles.has(zone)).sort();
    const atHome = home.has(`${reach.declaredIn}\0${reach.symbol}`);
    return [{ reach, owner: only, unit, partwise: shared.has(reach.declaredZone), atHome, silenced }];
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

const sharedDirectory = (files: readonly string[], project: Project): string => {
  const segments = files.map((file) => project.relative(file).split("/").slice(0, -1));
  const common: string[] = [];

  for (const [index, name] of (segments[0] ?? []).entries()) {
    if (!segments.every((parts) => parts[index] === name)) break;
    common.push(name);
  }

  return common.join("/");
};

interface Reading {
  readonly project: Project;
  readonly unitOf: UnitOf;
}

const consumerOf = (group: readonly Reported[], entry: Reported, { project, unitOf }: Reading): string => {
  const files = [...new Set(group.flatMap(({ reach }) => [...reach.files]))].filter(
    (file) => unitOf(entry.reach.declaredIn, file) === entry.unit,
  );
  const only = files[0];
  if (files.length === 1 && only !== undefined) return project.relative(only);

  return `${entry.partwise ? sharedDirectory(files, project) : entry.owner} (${files.length} files)`;
};

const listed = (entry: Reported, { project, unitOf }: Reading): readonly string[] => {
  const mine: string[] = [];
  const others: string[] = [];

  for (const [name, files] of entry.reach.through) {
    for (const file of files) {
      if (unitOf(entry.reach.declaredIn, file) !== entry.unit) continue;
      (name === entry.reach.symbol ? mine : others).push(`- ${name} in ${project.relative(file)}`);
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

interface Placed {
  readonly findings: readonly Finding[];
  readonly shapes: readonly PlacementShape[];
}

const shapesOf = (entry: Reported, atFile: boolean, typed: boolean): readonly PlacementShape[] => [
  entry.atHome ? "homeReads" : "oneName",
  ...(atFile ? (["neighbour"] as const) : []),
  ...(entry.partwise ? (["partwise"] as const) : []),
  ...(typed ? (["typeReaders"] as const) : []),
  ...(entry.silenced.length === 0 ? [] : (["silenced"] as const)),
];

const eachDeclaration = (group: readonly Reported[], from: string, reading: Reading): Placed => {
  const { project } = reading;
  const kin = readWithin(project, from);
  const findings: Finding[] = [];
  const shapes: PlacementShape[] = [];

  for (const entry of group) {
    const atFile = kin.has(entry.reach.symbol);
    const where = consumerOf([entry], entry, reading);
    const said = `${saying(entry, where, atFile)}${uncounted(entry.silenced, project)}`;
    const lines = listed(entry, reading);

    shapes.push(...shapesOf(entry, atFile, lines.length > 0));
    findings.push({
      severity: "error" as const,
      message: lines.length === 0 ? said : [`${said}:`, ...lines].join("\n"),
      file: entry.reach.declaredIn,
      start: null,
      symbols: [entry.reach.symbol],
      group: entry.reach.declaredIn,
    });
  }

  return { findings, shapes };
};

const misplaced = (group: readonly Reported[], readBy: ReadonlySet<string>, reading: Reading): Placed => {
  const first = group[0];
  if (first === undefined) return { findings: [], shapes: [] };

  const units = new Set(group.map(({ unit }) => unit));
  const wholeFile = units.size === 1 && readBy.size === 1 && readBy.has(first.unit);
  if (group.length === 1 || !wholeFile) return eachDeclaration(group, first.reach.declaredIn, reading);

  const where = consumerOf(group, first, reading);
  const silenced = [...new Set(group.flatMap((entry) => entry.silenced))].sort();

  return {
    findings: [
      {
        severity: "error" as const,
        message: `declares ${group.length} exports, all used only by ${where}, so the file is in the wrong directory rather than the declarations${uncounted(silenced, reading.project)}`,
        file: first.reach.declaredIn,
        start: null,
        symbols: group.map(({ reach }) => reach.symbol).sort(),
        group: first.reach.declaredIn,
      },
    ],
    shapes: [
      "wholeFile" as const,
      ...(first.partwise ? (["partwise"] as const) : []),
      ...(silenced.length === 0 ? [] : (["silenced"] as const)),
    ],
  };
};

export interface SharedZones {
  readonly zones: readonly ZoneDefinition[];
  readonly groups: readonly string[];
  readonly root: string;
}

export function colocationClaim(roleZones: readonly string[], sharing: SharedZones): Claim {
  const roles = new Set(roleZones);
  const named = sharing.zones.filter((zone) => zone.shared === true);
  const shared = new Set(named.map((zone) => zone.name));
  const partOf = partReader(sharing.groups, sharing.root);

  return {
    name: "no-value-is-declared-away-from-its-only-consumer",
    check: ({ project }) => {
      const unitOf: UnitOf = (declaredIn, reader) =>
        shared.has(project.zoneOf(declaredIn) ?? "") ? partOf(reader) : (project.zoneOf(reader) ?? "");
      const readBy = unitsReadingEach(project, roles, unitOf);
      const placed = byFile(reportedIn(project, { roles, shared, unitOf })).map(([file, group]) =>
        misplaced(group, readBy.get(file) ?? new Set(), { project, unitOf }),
      );

      return {
        findings: placed.flatMap(({ findings }) => findings),
        guidance: placementGuidance(new Set(placed.flatMap(({ shapes }) => shapes))),
      };
    },
  };
}
