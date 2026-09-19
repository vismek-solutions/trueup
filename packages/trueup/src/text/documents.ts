import picomatch from "picomatch";
import { toPosix } from "../paths/posix.ts";
import type { Span } from "../ports/span.ts";
import type { Project } from "../project/model.ts";
import type { Passage, Section } from "./model.ts";
import { passagesIn, sectionsIn } from "./passages.ts";

export interface Document {
  readonly file: string;
  readonly passages: readonly Passage[];
  readonly sections: readonly Section[];
}

export interface Surface {
  readonly files: readonly string[];
  readonly comments: boolean;
}

const pageOf = (file: string, source: string): Document => ({
  file,
  passages: passagesIn(source),
  sections: sectionsIn(source),
});

// a comment stands on its own, since prose does not flow across a marker the way it wraps in a page
const spoken = (comment: Span): Passage => ({
  kind: "paragraph",
  text: comment.text,
  start: comment.start,
});

const pagesIn = (project: Project, patterns: readonly string[]): readonly Document[] => {
  const wanted = picomatch([...patterns], { dot: true });

  return project.assets
    .filter((file) => wanted(toPosix(project.relative(file))))
    .map((file) => pageOf(file, project.sourceOf(file) ?? ""));
};

const commentsIn = (project: Project): readonly Document[] =>
  project.files.flatMap((file): readonly Document[] => {
    const comments = project.commentsIn(file);
    if (comments.length === 0) return [];

    return [{ file, passages: comments.map(spoken), sections: [] }];
  });

export const documentsIn = (project: Project, surface: Surface): readonly Document[] => [
  ...pagesIn(project, surface.files),
  ...(surface.comments ? commentsIn(project) : []),
];
