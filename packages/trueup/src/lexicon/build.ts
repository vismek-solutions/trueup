import type {
  Declaration,
  Mention,
  ModuleRecord,
  ReadComments,
  ReadDeclarations,
  ReadMentions,
} from "../ports/module-record.ts";
import type { Span } from "../ports/span.ts";
import type { Lexicon, Vocabulary } from "./model.ts";

export interface BuildLexiconInput {
  readonly modules: readonly ModuleRecord[];
  readonly sources: ReadonlyMap<string, string>;
  readonly readMentions: ReadMentions;
  readonly readDeclarations: ReadDeclarations;
  readonly readComments: ReadComments;
}

const exportedNamesOf = (record: ModuleRecord | undefined): readonly string[] =>
  (record?.exports ?? []).flatMap((entry) => (entry.form === "re-export-star" ? [] : [entry.exported]));

const literalsOf = (mentions: readonly Mention[]): readonly string[] =>
  mentions.flatMap((mention) => (mention.form === "string" ? [mention.text] : []));

export function buildLexicon({
  modules,
  sources,
  readMentions,
  readDeclarations,
  readComments,
}: BuildLexiconInput): Lexicon {
  const byPath = new Map(modules.map((record) => [record.path, record]));
  const walked = new Map<string, readonly Mention[]>();
  const declared = new Map<string, readonly Declaration[]>();
  const spoken = new Map<string, readonly Span[]>();

  const declarationsIn = (path: string): readonly Declaration[] => {
    const cached = declared.get(path);
    if (cached !== undefined) return cached;

    const text = sources.get(path);
    const found = text === undefined ? [] : readDeclarations(path, text);
    declared.set(path, found);
    return found;
  };

  const mentionsIn = (path: string): readonly Mention[] => {
    const cached = walked.get(path);
    if (cached !== undefined) return cached;

    const text = sources.get(path);
    const mentions = text === undefined ? [] : readMentions(path, text);
    walked.set(path, mentions);
    return mentions;
  };

  const commentsIn = (path: string): readonly Span[] => {
    const cached = spoken.get(path);
    if (cached !== undefined) return cached;

    const text = sources.get(path);
    const comments = text === undefined ? [] : readComments(path, text);
    spoken.set(path, comments);
    return comments;
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
    declarationsIn,
    commentsIn,
    exportedNamesIn: (path) => exportedNamesOf(byPath.get(path)),
    importedNamesIn: (path) =>
      new Set(
        (byPath.get(path)?.imports ?? []).flatMap((statement) =>
          statement.bindings.map((binding) => binding.local),
        ),
      ),
  };
}
