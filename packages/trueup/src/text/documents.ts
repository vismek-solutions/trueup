import picomatch from "picomatch";
import { toPosix } from "../paths/posix.ts";
import type { Project } from "../project/model.ts";
import type { Passage, Section } from "./model.ts";
import { passagesIn, sectionsIn } from "./passages.ts";

export interface Document {
  readonly file: string;
  readonly passages: readonly Passage[];
  readonly sections: readonly Section[];
}

const documentOf = (file: string, source: string): Document => ({
  file,
  passages: passagesIn(source),
  sections: sectionsIn(source),
});

export const documentsIn = (project: Project, patterns: readonly string[]): readonly Document[] => {
  const wanted = picomatch([...patterns], { dot: true });

  return project.assets
    .filter((file) => wanted(toPosix(project.relative(file))))
    .map((file) => documentOf(file, project.sourceOf(file) ?? ""));
};
