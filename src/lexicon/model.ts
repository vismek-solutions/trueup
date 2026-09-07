import type { Mention } from "../ports/module-record.ts";

export interface Vocabulary {
  readonly names: ReadonlySet<string>;
  readonly literals: ReadonlySet<string>;
}

export interface Lexicon {
  readonly vocabularyOf: (paths: readonly string[]) => Vocabulary;
  readonly mentionsIn: (path: string) => readonly Mention[];
  readonly importedNamesIn: (path: string) => ReadonlySet<string>;
}
