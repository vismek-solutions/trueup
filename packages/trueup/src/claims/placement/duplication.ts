import type { Project } from "../../project/model.ts";
import type { Finding } from "../../report/model.ts";
import { sharedHomes, type BoundaryRule } from "../boundary.ts";
import type { Claim } from "../model.ts";

const GUIDANCE = `The same declaration is written in more than one file.

Do this:
- Keep one copy where every caller may reach it, and delete the rest.
- Copies in different zones: the finding names the zones that may hold the one you keep. If it says none may, declare one.
- Moving into a new file: write it first, then delete the copies.
- Moving into an existing file: delete the copies, add it there, then import it. Adding it is refused until the copies are gone.

Not the fix: rewording one copy until it stops matching. Renaming does not close this either, because the name is not compared.

Two copies that mean different things stay apart: say so, and leave the finding for a person to accept.`;

interface Copy {
  readonly file: string;
  readonly name: string;
  readonly start: number;
}

const collapsed = (text: string): string => text.replace(/\s+/gu, " ").trim();

const copiesIn = (project: Project, minSize: number): Map<string, Copy[]> => {
  const byBody = new Map<string, Copy[]>();

  for (const file of project.files) {
    for (const declaration of project.declarationsIn(file)) {
      const body = collapsed(declaration.text);
      if (body.length < minSize) continue;

      const seen = byBody.get(body) ?? [];
      seen.push({ file, name: declaration.name, start: declaration.start });
      byBody.set(body, seen);
    }
  }

  return byBody;
};

const zonesBehind = (project: Project, { file, name }: Copy): readonly string[] =>
  project
    .importsWithin(file, [name, ...project.reachedWithin(file, [name])])
    .flatMap((edge) => (edge.declaredZone === null ? [] : [edge.declaredZone]));

const zonesOf = (project: Project, copies: readonly Copy[]): readonly string[] => {
  const zones = new Set<string>();

  for (const copy of copies) {
    const zone = project.zoneOf(copy.file);
    if (zone !== null) zones.add(zone);
  }

  return [...zones].sort();
};

const whereShared = (project: Project, rules: readonly BoundaryRule[], copies: readonly Copy[]): string => {
  const readers = zonesOf(project, copies);
  if (readers.length < 2) return "";

  const needs = copies.flatMap((copy) => zonesBehind(project, copy));
  const homes = [...sharedHomes({ needs, readers, names: project.zoneNames, rules })].sort();

  return homes.length === 0
    ? ", and no zone may hold a copy all of them could reach"
    : `, and a shared copy may live in ${homes.join(" or ")}`;
};

interface Duplicated {
  readonly project: Project;
  readonly rules: readonly BoundaryRule[];
  readonly group: string;
}

const findingsFor = (copies: readonly Copy[], { project, rules, group }: Duplicated): readonly Finding[] => {
  const files = new Set(copies.map((copy) => copy.file));
  if (files.size < 2) return [];

  const shared = whereShared(project, rules, copies);

  return copies.map((copy) => {
    const elsewhere = [...files]
      .filter((file) => file !== copy.file)
      .map((file) => project.relative(file))
      .sort();

    return {
      severity: "error" as const,
      message: `declares ${copy.name}, which is written the same way in ${elsewhere.join(", ")}${shared}`,
      file: copy.file,
      start: copy.start,
      group,
      symbols: [copy.name],
    };
  });
};

export interface DuplicationInput {
  readonly minSize: number;
  readonly boundaries: readonly BoundaryRule[];
}

export function duplicationClaim({ minSize, boundaries }: DuplicationInput): Claim {
  return {
    name: "no-declaration-is-written-twice",
    check: ({ project }) => ({
      findings: [...copiesIn(project, minSize)]
        .sort(([left], [right]) => (left < right ? -1 : 1))
        .flatMap(([body, copies]) =>
          findingsFor(copies, { project, rules: boundaries, group: body }),
        ),
      guidance: GUIDANCE,
    }),
  };
}
