import { dirname } from "node:path";
import type { Declaration } from "../ports/module-record.ts";
import type { ZoneRole } from "../zones/model.ts";
import type { Project } from "./model.ts";

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
  readonly importBack: readonly string[];
}

export interface NameReport {
  readonly name: string;
  readonly declared: boolean;
  readonly exported: boolean;
  readonly readers: NameReaders;
  readonly cut: NameCut | null;
}

const reachedFrom = (
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

const withinAny = (spans: readonly Declaration[], start: number): boolean =>
  spans.some((span) => start >= span.start && start < span.end);

const followedFrom = (project: Project, file: string, moving: ReadonlySet<string>): readonly string[] => {
  const spans = project.declarationsIn(file).filter((declaration) => moving.has(declaration.name));
  const mentioned = new Set(
    project
      .mentionsIn(file)
      .filter((mention) => mention.form === "name" && withinAny(spans, mention.start))
      .map((mention) => mention.text),
  );

  return spelt(
    project
      .imports()
      .filter((edge) => edge.from === file && mentioned.has(edge.local))
      .map((edge) => edge.specifier),
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

const cutOf = (project: Project, file: string, name: string): NameCut => {
  const uses = project.referencesIn(file);
  const others = project.exportsOf(file).filter((exported) => exported !== name);
  const needs = reachedFrom(uses, [name]);
  needs.delete(name);
  const keeps = reachedFrom(uses, others);

  const travels = [...needs].filter((other) => !keeps.has(other));
  const leaving = new Set([name, ...travels]);

  return {
    travels: spelt(travels),
    promote: spelt([...needs].filter((other) => keeps.has(other))),
    follows: followedFrom(project, file, leaving),
    importBack: spelt(
      [...uses].filter(([other, reads]) => !leaving.has(other) && reads.has(name)).map(([other]) => other),
    ),
  };
};

export const aboutName = (project: Project, file: string, name: string): NameReport => {
  const declared = project.declarationsIn(file).some((declaration) => declaration.name === name);

  return {
    name,
    declared,
    exported: project.exportsOf(file).includes(name),
    readers: readersOf(project, file, name),
    cut: declared ? cutOf(project, file, name) : null,
  };
};
