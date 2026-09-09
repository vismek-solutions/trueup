import { relative } from "node:path";
import type { EdgeTarget, SymbolGraph } from "../graph/model.ts";
import { targetPathOf } from "../graph/target.ts";
import type { Lexicon } from "../lexicon/model.ts";
import type { ZoneAssignment } from "../zones/model.ts";
import type { ImportQuery, Project, ResolvedImport } from "./model.ts";

export interface BuildProjectInput {
  readonly root: string;
  readonly graph: SymbolGraph;
  readonly zones: ZoneAssignment;
  readonly lexicon: Lexicon;
  readonly sources: ReadonlyMap<string, string>;
}

const declaringPathOf = (target: EdgeTarget): string | null =>
  target.kind === "external" ? null : targetPathOf(target);

export function buildProject({ root, graph, zones, lexicon, sources }: BuildProjectInput): Project {
  const resolved: readonly ResolvedImport[] = graph.edges.map((edge) => {
    const declaredIn = declaringPathOf(edge.to);
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
    zoneNames: zones.declaredNames,
    zoneOf: zones.zoneOf,
    filesIn: zones.filesIn,
    imports,
    exportsOf: lexicon.exportedNamesIn,
    sourceOf: (file) => sources.get(file) ?? null,
    mentionsIn: lexicon.mentionsIn,
    declarationsIn: lexicon.declarationsIn,
    vocabularyOf: (names) => lexicon.vocabularyOf(names.flatMap((name) => zones.filesIn(name))),
    relative: (file) => relative(root, file),
  };
}
