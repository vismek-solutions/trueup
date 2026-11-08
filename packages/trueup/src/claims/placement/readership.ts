import { dirname } from "node:path";
import type { Project } from "../../project/model.ts";
import type { Finding } from "../../report/model.ts";
import type { Claim } from "../model.ts";

const GUIDANCE = `This file's exports fall into groups that share no reader, so one file serves audiences that never meet.

Do this:
- Split the file so each group sits with its readers.
- If the finding says \`and only <name> can leave without taking anything else with it\`, move that one.
- When a group is a single export, dissolve it into its caller if the caller can derive it.
- When every export reaches one private thing this file holds, decide about that first. Promote it if it is a real module, and let each group become a file that reads it. If it is not, these exports are one unit, so accept the finding.

Not the fix: reaching for a new home before asking whether a group of one can dissolve.

A zone with a role is not reported and does not count as a reader.`;

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
