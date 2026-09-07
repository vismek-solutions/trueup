import type { CheckContext } from "../claims/model.js";
import type { Coverage } from "./model.js";

export function coverageOf({ graph, zones }: CheckContext): Coverage {
  const counts = { symbol: 0, external: 0, builtin: 0, namespace: 0 };
  for (const edge of graph.edges) {
    if (edge.to.kind in counts) counts[edge.to.kind as keyof typeof counts] += 1;
  }

  return {
    files: graph.files.size,
    edges: graph.edges.length,
    symbolEdges: counts.symbol,
    externalEdges: counts.external,
    builtinEdges: counts.builtin,
    namespaceEdges: counts.namespace,
    unresolvedImports: graph.unresolvedImports.length,
    filesByZone: Object.fromEntries(zones.declaredNames.map((name) => [name, zones.filesIn(name).length])),
    unclassifiedFiles: zones.unclassified.length,
  };
}
