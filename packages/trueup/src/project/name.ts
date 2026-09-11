import { dirname } from "node:path";
import type { ZoneRole } from "../zones/model.ts";
import type { Project, ResolvedImport } from "./model.ts";

export interface NameReaders {
  readonly files: readonly string[];
  readonly directories: readonly string[];
  readonly elsewhere: readonly string[];
  readonly zones: readonly { readonly name: string; readonly role: ZoneRole | null }[];
}

export interface NameCut {
  readonly travels: readonly string[];
  readonly promote: readonly string[];
  readonly follows: readonly string[];
  readonly opening: readonly string[] | null;
  readonly importBack: readonly string[];
}

export interface NameReport {
  readonly name: string;
  readonly declared: boolean;
  readonly exported: boolean;
  readonly readers: NameReaders;
  readonly cut: NameCut | null;
}

export const reachedFrom = (
  uses: ReadonlyMap<string, ReadonlySet<string>>,
  roots: Iterable<string>,
): Set<string> => {
  const seen = new Set<string>();
  const pending = [...roots];

  while (pending.length > 0) {
    const next = pending.pop();
    if (next === undefined || seen.has(next)) continue;
    seen.add(next);
    pending.push(...(uses.get(next) ?? []));
  }

  return seen;
};

const spelt = (values: Iterable<string>): readonly string[] => [...new Set(values)].sort();

const foreignTo =(project: Project, home: string, zones: readonly (string | null)[]): Set<string> =>
  new Set(
    zones.filter(
      (zone): zone is string => zone !== null && zone !== home && project.roleOf(zone) === null,
    ),
  );

interface Landing {
  readonly file: string;
  readonly from: string | null;
  readonly to: string;
  readonly kept: ReadonlySet<string>;
}

const openedBy = (
  project: Project,
  taken: readonly ResolvedImport[],
  { file, from, to, kept }: Landing,
): readonly string[] => {
  const every = project.imports();

  return spelt(
    taken.flatMap((edge) => {
      const { symbol, declaredIn, declaredZone } = edge;
      if (symbol === null || declaredIn === null || declaredZone === null) return [];
      if (declaredZone === to || declaredIn === file) return [];

      const readers = every.filter((other) => other.declaredIn === declaredIn && other.symbol === symbol);
      const stays = kept.has(edge.local) ? [from] : [];
      const before = foreignTo(project, declaredZone, readers.map((other) => other.fromZone));
      const after = foreignTo(project, declaredZone, [
        ...readers.filter((other) => other.from !== file).map((other) => other.fromZone),
        to,
        ...stays,
      ]);

      return after.size === 1 && before.size !== 1 ? [symbol] : [];
    }),
  );
};

const readersOf = (project: Project, file: string, name: string): NameReaders => {
  const edges = project.imports().filter((edge) => edge.declaredIn === file && edge.symbol === name);
  const home = project.relative(dirname(file)) || ".";
  const directories = spelt(edges.map((edge) => project.relative(dirname(edge.from)) || "."));

  return {
    files: spelt(edges.map((edge) => project.relative(edge.from))),
    directories,
    elsewhere: directories.filter((directory) => directory !== home),
    zones: spelt(edges.flatMap((edge) => (edge.fromZone === null ? [] : [edge.fromZone]))).map((zone) => ({
      name: zone,
      role: project.roleOf(zone),
    })),
  };
};

interface Moving {
  readonly file: string;
  readonly name: string;
  readonly to: string | null;
}

const cutOf = (project: Project, { file, name, to }: Moving): NameCut => {
  const uses = project.referencesIn(file);
  const others = project.exportsOf(file).filter((exported) => exported !== name);
  const needs = reachedFrom(uses, [name]);
  needs.delete(name);
  const keeps = reachedFrom(uses, others);

  const travels = [...needs].filter((other) => !keeps.has(other));
  const leaving = new Set([name, ...travels]);
  const staying = project.declarationsIn(file).flatMap((span) => (leaving.has(span.name) ? [] : [span.name]));
  const taken = project.importsWithin(file, [...leaving]);
  const kept = new Set(project.importsWithin(file, staying).map((edge) => edge.local));

  return {
    travels: spelt(travels),
    promote: spelt([...needs].filter((other) => keeps.has(other))),
    follows: spelt(taken.map((edge) => edge.specifier)),
    opening: to === null ? null : openedBy(project, taken, { file, from: project.zoneOf(file), to, kept }),
    importBack: spelt(
      [...uses].filter(([other, reads]) => !leaving.has(other) && reads.has(name)).map(([other]) => other),
    ),
  };
};

const landingFor = (readers: NameReaders, home: string | null): string | null => {
  const outside = readers.zones.filter((zone) => zone.role === null && zone.name !== home);
  const only = outside[0];

  return outside.length === 1 && only !== undefined ? only.name : null;
};

export const aboutName = (project: Project, file: string, name: string): NameReport => {
  const declared = project.declarationsIn(file).some((declaration) => declaration.name === name);
  const readers = readersOf(project, file, name);

  return {
    name,
    declared,
    exported: project.exportsOf(file).includes(name),
    readers,
    cut: declared ? cutOf(project, { file, name, to: landingFor(readers, project.zoneOf(file)) }) : null,
  };
};
