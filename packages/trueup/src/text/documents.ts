import picomatch from "picomatch";
import { toPosix } from "../paths/posix.ts";
import type { Span } from "../ports/span.ts";
import type { Project } from "../project/model.ts";
import type { Passage, Section } from "./model.ts";
import { looksLikeProse } from "./checks/strings.ts";
import { passagesIn, sectionsIn } from "./passages.ts";

export interface Document {
  readonly file: string;
  readonly passages: readonly Passage[];
  readonly sections: readonly Section[];
}

export interface Surface {
  readonly files: readonly string[];
  readonly comments: boolean;
  readonly strings: readonly string[];
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

export const matching = (project: Project, patterns: readonly string[]): ((file: string) => boolean) => {
  const wanted = picomatch([...patterns], { dot: true });
  return (file) => patterns.length > 0 && wanted(toPosix(project.relative(file)));
};

const pagesIn = (project: Project, patterns: readonly string[]): readonly Document[] =>
  project.assets
    .filter(matching(project, patterns))
    .map((file) => pageOf(file, project.sourceOf(file) ?? ""));

const commentsIn = (project: Project): readonly Document[] =>
  project.files.flatMap((file): readonly Document[] => {
    const comments = project.commentsIn(file);
    if (comments.length === 0) return [];

    return [{ file, passages: comments.map(spoken), sections: [] }];
  });

// a string is read as a page is, so a whole passage written into one holds its blank lines and its list
const written = (span: Span): readonly Passage[] =>
  passagesIn(span.text).map((passage) => ({ ...passage, start: passage.start + span.start }));

const stringsIn = (project: Project, patterns: readonly string[]): readonly Document[] =>
  project.files.filter(matching(project, patterns)).flatMap((file): readonly Document[] => {
    const said = project.proseIn(file).strings.filter((span) => looksLikeProse(span.text));
    if (said.length === 0) return [];

    return [{ file, passages: said.flatMap(written), sections: [] }];
  });

export const documentsIn = (project: Project, surface: Surface): readonly Document[] => [
  ...pagesIn(project, surface.files),
  ...(surface.comments ? commentsIn(project) : []),
  ...stringsIn(project, surface.strings),
];
