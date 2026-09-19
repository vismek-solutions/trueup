import type { Declaration, Mention, ProseInCode } from "../ports/module-record.ts";
import type { Span } from "../ports/span.ts";

export interface Vocabulary {
  readonly names: ReadonlySet<string>;
  readonly literals: ReadonlySet<string>;
}

export interface Lexicon {
  readonly vocabularyOf: (paths: readonly string[]) => Vocabulary;
  readonly mentionsIn: (path: string) => readonly Mention[];
  readonly declarationsIn: (path: string) => readonly Declaration[];
  readonly commentsIn: (path: string) => readonly Span[];
  readonly proseIn: (path: string) => ProseInCode;
  readonly importedNamesIn: (path: string) => ReadonlySet<string>;
  readonly exportedNamesIn: (path: string) => readonly string[];
}
