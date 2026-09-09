import type { Project } from "../project/model.ts";
import { judges, type BoundaryRule } from "./boundary.ts";

export interface ZoneFlow {
  readonly from: string;
  readonly to: string;
  readonly edges: number;
}

export interface Ungoverned {
  readonly unspoken: readonly ZoneFlow[];
  readonly allowed: readonly ZoneFlow[];
  readonly silentZones: readonly string[];
}

const flowsIn = (project: Project): ReadonlyMap<string, ReadonlyMap<string, number>> => {
  const counts = new Map<string, Map<string, number>>();

  for (const edge of project.imports()) {
    const { fromZone, declaredZone } = edge;
    if (fromZone === null || declaredZone === null || fromZone === declaredZone) continue;

    const reached = counts.get(fromZone) ?? new Map<string, number>();
    reached.set(declaredZone, (reached.get(declaredZone) ?? 0) + 1);
    counts.set(fromZone, reached);
  }

  return counts;
};

const heaviestFirst = (left: ZoneFlow, right: ZoneFlow): number => {
  if (left.edges !== right.edges) return right.edges - left.edges;
  if (left.from !== right.from) return left.from < right.from ? -1 : 1;
  return left.to < right.to ? -1 : 1;
};

export const ungovernedFlows = (project: Project, rules: readonly BoundaryRule[]): Ungoverned => {
  const forbids = (from: string, to: string): boolean =>
    rules.some((rule) => rule.from === from && !rule.allow.includes(to) && judges(rule, to));

  const permits = (from: string, to: string): boolean =>
    rules.some((rule) => rule.from === from && rule.allow.includes(to));

  const unspoken: ZoneFlow[] = [];
  const allowed: ZoneFlow[] = [];

  for (const [from, reached] of flowsIn(project)) {
    for (const [to, edges] of reached) {
      if (forbids(from, to)) continue;
      (permits(from, to) ? allowed : unspoken).push({ from, to, edges });
    }
  }

  const named = new Set(rules.map((rule) => rule.from));

  return {
    unspoken: unspoken.sort(heaviestFirst),
    allowed: allowed.sort(heaviestFirst),
    silentZones: project.zoneNames.filter((zone) => !named.has(zone)),
  };
};
