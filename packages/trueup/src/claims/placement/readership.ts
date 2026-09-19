import { dirname } from "node:path";
import type { Project } from "../../project/model.ts";
import type { Finding } from "../../report/model.ts";
import type { Claim } from "../model.ts";

const GUIDANCE = `The exports of this file fall into groups that no reader takes from across, so one file is serving audiences that never meet. Split it, and each half sits with the readers it has.

The shape of the finding decides which part moves:
- \`and only <name> can leave without taking anything else with it\` names the part that lifts out on its own. Move that one, and opening the file will not give you a better answer than the check already has.
- With no such clause, either every part reaches something private this file holds, or no part does and either half may go first.

Do this:
- When a group is a single export, dissolve it rather than rehousing it. A value one caller derives from what it already holds belongs inside that caller, and then there is no second file to place.
- When every export reaches one private thing this file holds, a context or a client or a table, no export can leave without promoting it. Decide about that private thing first. If it is a real module, something you would be content to name and let another file import, promote it and let each readership become a file that reads it. If it is not, these exports are one unit and this finding is one to accept rather than act on.

Not the fix: reaching for a new home before asking whether a group of one can dissolve. That is the mistake this check sees most often.

A declaration that names another in the same file counts with it, because one is built from the other. Two that merely reach the same private third do not, because sharing a helper is not being one thing, and promoting that helper is the cost the split would carry. An export nothing reads is left out, because unused code is a different finding. A zone with a role is not reported and does not count as a reader: a barrel, a composition root and a test suite each answer to readers this analysis does not own.`;

type Readers = Map<string, Set<string>>;

const grouped = <T>(items: readonly T[], joined: (left: T, right: T) => boolean): T[][] => {
  const parts: T[][] = [];

  for (const item of items) {
    const touching = parts.filter((part) => part.some((other) => joined(item, other)));
    for (const part of touching) parts.splice(parts.indexOf(part), 1);
    parts.push([item, ...touching.flat()]);
  }

  return parts;
};

const readersByFile = (project: Project, roles: ReadonlySet<string>): Map<string, Readers> => {
  const byFile = new Map<string, Readers>();

  for (const edge of project.imports()) {
    if (edge.declaredIn === null || edge.symbol === null) continue;
    if (roles.has(edge.fromZone ?? "")) continue;

    const readers = byFile.get(edge.declaredIn) ?? new Map<string, Set<string>>();
    const directories = readers.get(edge.symbol) ?? new Set<string>();
    directories.add(dirname(edge.from));
    readers.set(edge.symbol, directories);
    byFile.set(edge.declaredIn, readers);
  }

  return byFile;
};

const kinIn = (project: Project, file: string): ReadonlyMap<string, ReadonlySet<string>> => {
  const uses = project.referencesIn(file);
  const kin = new Map([...uses.keys()].map((name) => [name, new Set<string>()]));

  for (const [holder, used] of uses) {
    for (const name of used) {
      kin.get(holder)?.add(name);
      kin.get(name)?.add(holder);
    }
  }

  return kin;
};

const readershipOf = (project: Project, part: readonly string[], readers: Readers): string => {
  const names = [...part].sort().join(", ");
  const where = [...new Set(part.flatMap((symbol) => [...(readers.get(symbol) ?? [])]))]
    .map((directory) => project.relative(directory) || ".")
    .sort()
    .join(", ");

  return `${names} from ${where}`;
};

const freePart = (
  project: Project,
  file: string,
  parts: readonly (readonly string[])[],
): readonly string[] | null => {
  const free = parts.filter((part) => project.reachedWithin(file, part).length === 0);
  const only = free[0];

  return free.length === 1 && only !== undefined ? only : null;
};

const splitIn = (project: Project, file: string, readers: Readers): Finding | null => {
  const symbols = [...readers.keys()];
  const kin = kinIn(project, file);
  const joined = (left: string, right: string): boolean =>
    kin.get(left)?.has(right) === true ||
    [...(readers.get(left) ?? [])].some((directory) => readers.get(right)?.has(directory) === true);

  const parts = grouped(symbols, joined);
  if (parts.length < 2) return null;

  const shown = parts
    .map((part) => readershipOf(project, part, readers))
    .sort()
    .map((part) => `- ${part}`);

  const free = freePart(project, file, parts);
  const direction =
    free === null
      ? ""
      : `, and only ${[...free].sort().join(", ")} can leave without taking anything else with it`;

  return {
    severity: "error",
    message: [`serves ${parts.length} readerships that never meet${direction}:`, ...shown].join("\n"),
    file,
    start: null,
  };
};

export function readershipClaim(roleZones: readonly string[]): Claim {
  const roles = new Set(roleZones);

  return {
    name: "no-file-serves-two-readerships",
    onePerFile: true,
    check: ({ project }) => {
      const byFile = readersByFile(project, roles);

      const findings: readonly Finding[] = [...byFile]
        .filter(([file]) => !roles.has(project.zoneOf(file) ?? ""))
        .sort(([left], [right]) => (left < right ? -1 : 1))
        .flatMap(([file, readers]) => splitIn(project, file, readers) ?? []);

      return { findings, guidance: GUIDANCE };
    },
  };
}
