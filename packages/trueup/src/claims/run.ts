import type { SymbolGraph } from "../graph/model.ts";
import type { Coverage, Report } from "../report/model.ts";
import type { ZoneAssignment } from "../zones/model.ts";
import type { CheckContext, Claim } from "./model.ts";

interface CoverageInput {
  readonly graph: SymbolGraph;
  readonly zones: ZoneAssignment;
}

const coverageOf = ({ graph, zones }: CoverageInput): Coverage => {
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
};

export function runClaims(claims: readonly Claim[], context: CheckContext): Report {
  return {
    claims: claims.map((claim) => ({
      claim: claim.name,
      onePerFile: claim.onePerFile,
      ...claim.check(context),
    })),
    coverage: coverageOf(context),
  };
}
