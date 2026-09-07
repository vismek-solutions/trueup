import { relative } from "node:path";
import type { EdgeTarget } from "../graph/model.ts";
import type { Claim } from "./model.ts";
import type { ZoneReference } from "./zone-references.ts";

export type EdgeAnchor = "declaring-file" | "imported-module";

export interface BoundaryRule {
  readonly from: string;
  readonly mayNotReach: readonly string[];
  readonly anchor?: EdgeAnchor | undefined;
  readonly ignoreTypeOnly?: boolean | undefined;
}

const pathOf = (target: EdgeTarget): string | null => {
  switch (target.kind) {
    case "symbol":
    case "namespace":
    case "missing-export":
      return target.path;
    case "external":
      return target.path;
    case "builtin":
    case "ambiguous":
      return null;
  }
};

export function boundaryClaim(rules: readonly BoundaryRule[]): Claim {
  return {
    name: "every-import-respects-its-zone-boundary",
    check: ({ root, graph, zones }) => {
      const byOrigin = new Map<string, BoundaryRule[]>();
      for (const rule of rules) {
        const existing = byOrigin.get(rule.from);
        if (existing === undefined) byOrigin.set(rule.from, [rule]);
        else existing.push(rule);
      }

      return graph.edges.flatMap((edge) => {
        const fromZone = zones.zoneOf(edge.from);
        if (fromZone === null) return [];

        const applicable = byOrigin.get(fromZone) ?? [];
        return applicable.flatMap((rule) => {
          if (rule.ignoreTypeOnly === true && edge.kind === "type") return [];

          const anchored = rule.anchor === "imported-module" ? edge.via : pathOf(edge.to);
          if (anchored === null) return [];

          const targetZone = zones.zoneOf(anchored);
          if (targetZone === null || !rule.mayNotReach.includes(targetZone)) return [];

          const reached =
            edge.via === anchored
              ? relative(root, anchored)
              : `${relative(root, anchored)} through ${relative(root, edge.via)}`;

          return [
            {
              severity: "error" as const,
              message: `${relative(root, edge.from)} is ${fromZone} and may not reach ${targetZone}: ${edge.imported} from ${reached}`,
              file: edge.from,
              start: edge.start,
            },
          ];
        });
      });
    },
  };
}

export const boundaryZoneReferences = (rules: readonly BoundaryRule[]): readonly ZoneReference[] =>
  rules.flatMap((rule) =>
    [rule.from, ...rule.mayNotReach].map((zone) => ({ rule: `boundary rule from ${rule.from}`, zone })),
  );
