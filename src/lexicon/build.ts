import type { Mention, ModuleRecord, ReadMentions } from "../ports/module-record.ts";
import type { Lexicon, Vocabulary } from "./model.ts";

export interface BuildLexiconInput {
  readonly modules: readonly ModuleRecord[];
  readonly sources: ReadonlyMap<string, string>;
  readonly readMentions: ReadMentions;
}

export function buildLexicon({ modules, sources, readMentions }: BuildLexiconInput): Lexicon {
  const byPath = new Map(modules.map((record) => [record.path, record]));
  const walked = new Map<string, readonly Mention[]>();

  const mentionsIn = (path: string): readonly Mention[] => {
    const cached = walked.get(path);
    if (cached !== undefined) return cached;

    const text = sources.get(path);
    const mentions = text === undefined ? [] : readMentions(path, text);
    walked.set(path, mentions);
    return mentions;
  };

  const vocabularyOf = (paths: readonly string[]): Vocabulary => {
    const names = new Set<string>();
    const literals = new Set<string>();

    for (const path of paths) {
      for (const entry of byPath.get(path)?.exports ?? []) {
        if (entry.form !== "re-export-star") names.add(entry.exported);
      }
      for (const mention of mentionsIn(path)) {
        if (mention.form === "string") literals.add(mention.text);
      }
    }

    return { names, literals };
  };

  return {
    vocabularyOf,
    mentionsIn,
    exportedNamesIn: (path) =>
      (byPath.get(path)?.exports ?? []).flatMap((entry) => (entry.form === "re-export-star" ? [] : [entry.exported])),
    importedNamesIn: (path) =>
      new Set(
        (byPath.get(path)?.imports ?? []).flatMap((statement) =>
          statement.bindings.map((binding) => binding.local),
        ),
      ),
  };
}
