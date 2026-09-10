import type { Project } from "../../project/model.ts";
import type { Finding } from "../../report/model.ts";
import type { Claim } from "../model.ts";

const GUIDANCE =
  "The same declaration was written more than once, in files that could have shared it. This is what an agent does when it cannot find what already exists: every copy is individually correct, and the codebase grows a second answer to a question it had already answered. Keep one, put it where every caller may reach it, and delete the rest. Under the write-time guard, empty the existing copies before creating the shared file: a new file holding a declaration that still stands elsewhere is refused as one more copy. If the copies have drifted apart, they were two ideas wearing one shape. Rename them so the next reader is not misled.";

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

const findingsFor = (copies: readonly Copy[], project: Project, group: string): readonly Finding[] => {
  const files = new Set(copies.map((copy) => copy.file));
  if (files.size < 2) return [];

  return copies.map((copy) => {
    const elsewhere = [...files]
      .filter((file) => file !== copy.file)
      .map((file) => project.relative(file))
      .sort();

    return {
      severity: "error" as const,
      message: `declares ${copy.name}, which is written the same way in ${elsewhere.join(", ")}`,
      file: copy.file,
      start: copy.start,
      group,
      symbol: copy.name,
    };
  });
};

export function duplicationClaim(minSize: number): Claim {
  return {
    name: "no-declaration-is-written-twice",
    guidance: GUIDANCE,
    check: ({ project }) =>
      [...copiesIn(project, minSize)]
        .sort(([left], [right]) => (left < right ? -1 : 1))
        .flatMap(([body, copies]) => findingsFor(copies, project, body)),
  };
}
