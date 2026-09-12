import type { Project } from "../../project/model.ts";
import type { Finding } from "../../report/model.ts";
import { sharedHomes, type BoundaryRule } from "../boundary.ts";
import type { Claim } from "../model.ts";

const GUIDANCE = [
  "The same declaration was written more than once, in files that could have shared it. This is what an agent does when it cannot find what already exists: every copy is individually correct, and the codebase grows a second answer to a question it had already answered.",
  "",
  "Do this:",
  "- Keep one copy, put it where every caller may reach it, and delete the rest.",
  "- When the copies sit in different zones the finding names the zones that may hold the one you keep. If it names none, no zone both reaches what the declaration needs and is reachable from every copy, so a zone has to be declared before this can be shared at all.",
  "- Under the write-time guard, write the shared file first and delete the copies after. A file that does not exist yet is let through holding declarations that still stand elsewhere, because a move looks exactly like a copy until the old one is gone. This claim keeps failing until it is.",
  "- If the copies have drifted apart, they were two ideas wearing one shape. Rename them so the next reader is not misled.",
].join("\n");

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
