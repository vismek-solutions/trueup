import type {
  Mention,
  ModuleRecord,
  ProseInCode,
  ReadProse,
  SourceFacts,
} from "../ports/module-record.ts";
import type { Lexicon, Vocabulary } from "./model.ts";

export interface BuildLexiconInput {
  readonly facts: ReadonlyMap<string, SourceFacts>;
  readonly sources: ReadonlyMap<string, string>;
  readonly readProse: ReadProse;
}

const NOTHING: ProseInCode = { strings: [], joined: [] };

const exportedNamesOf = (record: ModuleRecord | undefined): readonly string[] =>
  (record?.exports ?? []).flatMap((entry) => (entry.form === "re-export-star" ? [] : [entry.exported]));

const literalsOf = (mentions: readonly Mention[]): readonly string[] =>
  mentions.flatMap((mention) => (mention.form === "string" ? [mention.text] : []));

export function buildLexicon({ facts, sources, readProse }: BuildLexiconInput): Lexicon {
  const said = new Map<string, ProseInCode>();
  const recordOf = (path: string): ModuleRecord | undefined => facts.get(path)?.record;
  const mentionsIn = (path: string): readonly Mention[] => facts.get(path)?.mentions ?? [];

  const proseIn = (path: string): ProseInCode => {
    const cached = said.get(path);
    if (cached !== undefined) return cached;

    const text = sources.get(path);
    const prose = text === undefined ? NOTHING : readProse(path, text);
    said.set(path, prose);
    return prose;
  };

  const vocabularyOf = (paths: readonly string[]): Vocabulary => {
    const names = new Set<string>();
    const literals = new Set<string>();

    for (const path of paths) {
      for (const name of exportedNamesOf(recordOf(path))) names.add(name);
      for (const literal of literalsOf(mentionsIn(path))) literals.add(literal);
    }

    return { names, literals };
  };

  return {
    vocabularyOf,
    mentionsIn,
    declarationsIn: (path) => facts.get(path)?.declarations ?? [],
    commentsIn: (path) => facts.get(path)?.comments ?? [],
    proseIn,
    exportedNamesIn: (path) => exportedNamesOf(recordOf(path)),
    importedNamesIn: (path) =>
      new Set(
        (recordOf(path)?.imports ?? []).flatMap((statement) =>
          statement.bindings.map((binding) => binding.local),
        ),
      ),
  };
}
