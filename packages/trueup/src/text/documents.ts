import picomatch from "picomatch";
import { toPosix } from "../paths/posix.ts";
import type { Project } from "../project/model.ts";
import type { Passage } from "./model.ts";
import { passagesIn } from "./passages.ts";

export interface Document {
  readonly file: string;
  readonly passages: readonly Passage[];
}

export const documentsIn = (
  project: Project,
  patterns: readonly string[],
): readonly Document[] => {
  const wanted = picomatch([...patterns], { dot: true });

  return project.assets
    .filter((file) => wanted(toPosix(project.relative(file))))
    .map((file) => ({ file, passages: passagesIn(project.sourceOf(file) ?? "") }));
};
