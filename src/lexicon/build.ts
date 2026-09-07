import type { Mention, ModuleRecord, ReadMentions } from "../ports/module-record.ts";
import type { Lexicon, Vocabulary } from "./model.ts";

export interface BuildLexiconInput {
  readonly modules: readonly ModuleRecord[];
  readonly sources: ReadonlyMap<string, string>;
  readonly readMentions: ReadMentions;
}

const exportedNamesOf = (record: ModuleRecord | undefined): readonly string[] =>
  (record?.exports ?? []).flatMap((entry) => (entry.form === "re-export-star" ? [] : [entry.exported]));

const literalsOf = (mentions: readonly Mention[]): readonly string[] =>
  mentions.flatMap((mention) => (mention.form === "string" ? [mention.text] : []));

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
      for (const name of exportedNamesOf(byPath.get(path))) names.add(name);
      for (const literal of literalsOf(mentionsIn(path))) literals.add(literal);
    }

    return { names, literals };
  };

  return {
    vocabularyOf,
    mentionsIn,
    exportedNamesIn: (path) => exportedNamesOf(byPath.get(path)),
    importedNamesIn: (path) =>
      new Set(
        (byPath.get(path)?.imports ?? []).flatMap((statement) =>
          statement.bindings.map((binding) => binding.local),
        ),
      ),
  };
}
