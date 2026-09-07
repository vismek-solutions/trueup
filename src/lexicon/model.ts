import type { Declaration, Mention } from "../ports/module-record.ts";

export interface Vocabulary {
  readonly names: ReadonlySet<string>;
  readonly literals: ReadonlySet<string>;
}

export interface Lexicon {
  readonly vocabularyOf: (paths: readonly string[]) => Vocabulary;
  readonly mentionsIn: (path: string) => readonly Mention[];
  readonly declarationsIn: (path: string) => readonly Declaration[];
  readonly importedNamesIn: (path: string) => ReadonlySet<string>;
  readonly exportedNamesIn: (path: string) => readonly string[];
}
