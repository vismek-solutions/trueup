import { relative } from "node:path";
import type { SymbolGraph } from "../graph/model.ts";
import { targetPathOf } from "../graph/target.ts";
import type { Lexicon } from "../lexicon/model.ts";
import type { ZoneAssignment } from "../zones/model.ts";
import type { ImportQuery, Project, ResolvedImport } from "./model.ts";
import { reachedFrom } from "./name.ts";

export interface BuildProjectInput {
  readonly root: string;
  readonly graph: SymbolGraph;
  readonly zones: ZoneAssignment;
  readonly lexicon: Lexicon;
  readonly sources: ReadonlyMap<string, string>;
  readonly assets?: ReadonlyMap<string, string> | undefined;
}

const NO_ASSETS: ReadonlyMap<string, string> = new Map();

export function buildProject(input: BuildProjectInput): Project {
  const { root, graph, zones, lexicon, sources, assets = NO_ASSETS } = input;
  const resolved: readonly ResolvedImport[] = graph.edges.map((edge) => {
    const declaredIn = targetPathOf(edge.to);
    return {
      from: edge.from,
      fromZone: zones.zoneOf(edge.from),
      specifier: edge.specifier,
      via: edge.via,
      viaZone: zones.zoneOf(edge.via),
      imported: edge.imported,
      local: edge.local,
      kind: edge.kind,
      symbol: edge.to.kind === "symbol" ? edge.to.name : null,
      declaredIn,
      declaredZone: declaredIn === null ? null : zones.zoneOf(declaredIn),
      at: edge.start,
      target: edge.to,
    };
  });

  const referencesIn = (file: string): ReadonlyMap<string, ReadonlySet<string>> => {
    const declarations = lexicon.declarationsIn(file);
    const named = new Set(declarations.map((declaration) => declaration.name));
    const uses = new Map(declarations.map((declaration) => [declaration.name, new Set<string>()]));

    for (const mention of lexicon.mentionsIn(file)) {
      if (mention.form !== "name" || !named.has(mention.text)) continue;

      const holder = declarations.find(
        (declaration) => mention.start >= declaration.start && mention.start < declaration.end,
      );
      if (holder === undefined || holder.name === mention.text) continue;
      uses.get(holder.name)?.add(mention.text);
    }

    return uses;
  };

  const reachedWithin = (file: string, names: readonly string[]): readonly string[] => {
    const reached = reachedFrom(referencesIn(file), names);
    for (const name of names) reached.delete(name);

    return [...reached].sort();
  };

  const importsWithin = (file: string, names: readonly string[]): readonly ResolvedImport[] => {
    const wanted = new Set(names);
    const spans = lexicon.declarationsIn(file).filter((span) => wanted.has(span.name));
    const held = (start: number): boolean =>
      spans.some((span) => start >= span.start && start < span.end);
    const locals = new Set(
      lexicon
        .mentionsIn(file)
        .filter((mention) => mention.form === "name" && held(mention.start))
        .map((mention) => mention.text),
    );

    return resolved.filter((edge) => edge.from === file && locals.has(edge.local));
  };

  const imports = (query?: ImportQuery): readonly ResolvedImport[] =>
    query === undefined
      ? resolved
      : resolved.filter(
          (entry) =>
            (query.fromZone === undefined || entry.fromZone === query.fromZone) &&
            (query.declaredZone === undefined || entry.declaredZone === query.declaredZone) &&
            (query.kind === undefined || entry.kind === query.kind),
        );

  return {
    root,
    files: [...graph.files],
    assets: [...assets.keys()],
    zoneNames: zones.declaredNames,
    zoneOf: zones.zoneOf,
    roleOf: zones.roleOf,
    filesIn: zones.filesIn,
    imports,
    exportsOf: lexicon.exportedNamesIn,
    sourceOf: (file) => sources.get(file) ?? assets.get(file) ?? null,
    mentionsIn: lexicon.mentionsIn,
    declarationsIn: lexicon.declarationsIn,
    commentsIn: lexicon.commentsIn,
    referencesIn,
    importsWithin,
    reachedWithin,
    vocabularyOf: (names) => lexicon.vocabularyOf(names.flatMap((name) => zones.filesIn(name))),
    relative: (file) => relative(root, file),
  };
}
