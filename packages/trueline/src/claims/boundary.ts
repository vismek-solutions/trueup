import { relative } from "node:path";
import type { SymbolImportEdge } from "../graph/model.ts";
import { targetPathOf } from "../graph/target.ts";
import { inside } from "../paths/inside.ts";
import type { Finding } from "../report/model.ts";
import type { Claim } from "./model.ts";
import type { ZoneReference } from "./zone-references.ts";

export type EdgeAnchor = "declaring-file" | "imported-module";

export interface BoundaryRule {
  readonly from: string;
  readonly allow: readonly string[];
  readonly anchor?: EdgeAnchor | undefined;
  readonly ignoreTypeOnly?: boolean | undefined;
  readonly within?: string | undefined;
}

interface BreachInput {
  readonly root: string;
  readonly zoneOf: (path: string) => string | null;
  readonly fromZone: string;
}

const breachOf = (edge: SymbolImportEdge, rule: BoundaryRule, input: BreachInput): Finding | null => {
  if (rule.ignoreTypeOnly === true && edge.kind === "type") return null;

  const anchored = rule.anchor === "imported-module" ? edge.via : targetPathOf(edge.to);
  if (anchored === null) return null;
  if (rule.within !== undefined && !inside(rule.within, anchored)) return null;

  const targetZone = input.zoneOf(anchored);
  if (targetZone === null || targetZone === input.fromZone || rule.allow.includes(targetZone)) return null;

  const { root, fromZone } = input;
  const reached =
    edge.via === anchored
      ? relative(root, anchored)
      : `${relative(root, anchored)} through ${relative(root, edge.via)}`;

  return {
    severity: "error",
    message: `is ${fromZone} and may not reach ${targetZone}: ${edge.imported} from ${reached}`,
    file: edge.from,
    start: edge.start,
  };
};

const rulesByOrigin = (rules: readonly BoundaryRule[]): ReadonlyMap<string, BoundaryRule[]> => {
  const byOrigin = new Map<string, BoundaryRule[]>();

  for (const rule of rules) {
    const existing = byOrigin.get(rule.from);
    if (existing === undefined) byOrigin.set(rule.from, [rule]);
    else existing.push(rule);
  }

  return byOrigin;
};

export function boundaryClaim(rules: readonly BoundaryRule[]): Claim {
  return {
    name: "every-import-respects-its-zone-boundary",
    guidance:
      "Code in one zone reached a symbol declared in a zone it may not reach. The edge is named by its declaring file, so a barrel in between does not excuse it. Move the code to a zone that may reach the target, or have the target expose what the caller needs through a zone it may reach. Run `{trueline} explain <file>` to see what a file may reach. Widening the rule is not the fix.",
    check: ({ root, graph, zones }) => {
      const byOrigin = rulesByOrigin(rules);
      const zoneOf = (path: string): string | null => zones.zoneOf(path);

      return graph.edges.flatMap((edge) => {
        const fromZone = zoneOf(edge.from);
        if (fromZone === null) return [];

        const breach = (byOrigin.get(fromZone) ?? [])
          .map((rule) => breachOf(edge, rule, { root, zoneOf, fromZone }))
          .find((finding): finding is Finding => finding !== null);

        return breach === undefined ? [] : [breach];
      });
    },
  };
}

export const boundaryZoneReferences = (rules: readonly BoundaryRule[]): readonly ZoneReference[] =>
  rules.flatMap((rule) =>
    [rule.from, ...rule.allow].map((zone) => ({ rule: `boundary rule from ${rule.from}`, zone })),
  );
