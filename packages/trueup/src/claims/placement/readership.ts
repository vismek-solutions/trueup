import { dirname } from "node:path";
import type { Project } from "../../project/model.ts";
import type { Finding } from "../../report/model.ts";
import type { Claim } from "../model.ts";

const GUIDANCE =
  "The exports of this file fall into groups that no reader takes from across, so one file is serving audiences that never meet. Split it, and each half sits with the readers it has. When a group is a single export, dissolving it usually beats rehousing it: a value one caller derives from what it already holds belongs inside that caller, and then there is no second file to place — reaching for a new home first is the common mistake here. When every export reaches one private thing this file holds — a context, a client, a table — the split is real but cutting the file in two is the wrong half of the answer: move the export that has its own audience out, since the private thing would have to be promoted to survive a cut. This check can see that the audiences differ; it cannot tell you which side should move. A declaration that names another in the same file counts with it, because one is built from the other. Two that merely reach the same private third do not, because sharing a helper is not being one thing — and promoting that helper is precisely the cost the split would carry. An export nothing reads is left out, because unused code is a different finding. A zone with a role is not reported and does not count as a reader: a barrel, a composition root and a test suite each answer to readers this analysis does not own.";

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
    .join("; ");

  return {
    severity: "error",
    message: `serves ${parts.length} readerships that never meet: ${shown}`,
    file,
    start: null,
  };
};

export function readershipClaim(roleZones: readonly string[]): Claim {
  const roles = new Set(roleZones);

  return {
    name: "no-file-serves-two-readerships",
    guidance: GUIDANCE,
    check: ({ project }): readonly Finding[] => {
      const byFile = readersByFile(project, roles);

      return [...byFile]
        .filter(([file]) => !roles.has(project.zoneOf(file) ?? ""))
        .sort(([left], [right]) => (left < right ? -1 : 1))
        .flatMap(([file, readers]) => splitIn(project, file, readers) ?? []);
    },
  };
}
