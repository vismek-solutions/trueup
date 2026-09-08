import { isAbsolute, relative } from "node:path";
import type { ImportQuery, Project, ResolvedImport } from "../project/model.ts";

export interface Scope {
  readonly directory: string;
  readonly prefix: string;
}

const inside = (directory: string, path: string): boolean => {
  const step = relative(directory, path);
  return step !== "" && !step.startsWith("..") && !isAbsolute(step);
};

const stripped = (prefix: string, zone: string | null): string | null =>
  zone?.startsWith(prefix) === true ? zone.slice(prefix.length) : null;

export const scopedTo = (project: Project, { directory, prefix }: Scope): Project => {
  const qualify = (zone: string): string => `${prefix}${zone}`;

  const narrow = (entry: ResolvedImport): ResolvedImport => ({
    ...entry,
    fromZone: stripped(prefix, entry.fromZone),
    viaZone: stripped(prefix, entry.viaZone),
    declaredZone: stripped(prefix, entry.declaredZone),
  });

  return {
    root: project.root,
    relative: project.relative,
    files: project.files.filter((file) => inside(directory, file)),
    zoneNames: project.zoneNames
      .filter((zone) => zone.startsWith(prefix))
      .map((zone) => zone.slice(prefix.length)),
    zoneOf: (file) => (inside(directory, file) ? stripped(prefix, project.zoneOf(file)) : null),
    filesIn: (zone) => project.filesIn(qualify(zone)),
    imports: (query?: ImportQuery) =>
      project
        .imports({
          ...query,
          ...(query?.fromZone === undefined ? {} : { fromZone: qualify(query.fromZone) }),
          ...(query?.declaredZone === undefined ? {} : { declaredZone: qualify(query.declaredZone) }),
        })
        .filter((entry) => inside(directory, entry.from))
        .map(narrow),
    exportsOf: project.exportsOf,
    mentionsIn: project.mentionsIn,
    declarationsIn: project.declarationsIn,
    vocabularyOf: (zones) => project.vocabularyOf(zones.map(qualify)),
  };
};
