import type { ModuleRecord } from "../ports/module-record.ts";
import type { Lexicon, Vocabulary } from "./model.ts";

export function buildLexicon(modules: readonly ModuleRecord[]): Lexicon {
  const byPath = new Map(modules.map((record) => [record.path, record]));

  const vocabularyOf = (paths: readonly string[]): Vocabulary => {
    const names = new Set<string>();
    const literals = new Set<string>();

    for (const path of paths) {
      const record = byPath.get(path);
      if (record === undefined) continue;
      for (const entry of record.exports) {
        if (entry.form !== "re-export-star") names.add(entry.exported);
      }
      for (const mention of record.mentions) {
        if (mention.form === "string") literals.add(mention.text);
      }
    }

    return { names, literals };
  };

  return {
    vocabularyOf,
    mentionsIn: (path) => byPath.get(path)?.mentions ?? [],
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
