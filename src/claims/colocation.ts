import type { ResolvedImport } from "../project/model.ts";
import type { Finding } from "../report/model.ts";
import type { Claim } from "./model.ts";

const GUIDANCE =
  "A zone exports a value that only one other zone uses, so the seam it crosses carries nothing a second caller needs — a symbol in a shared package that one consumer uses is not shared, it is that consumer's code in the wrong place. Move it to the zone that uses it. A second consumer arriving later is a reason to move it back then, not a reason to leave it now. Type-only edges are not reported, because a type can be used through a value without ever being imported. Declaring a zone `consumesOnly` silences it as a consumer, and is honest only for a zone that never owns what it uses, such as a composition root or a test suite.";

type Crossing = ResolvedImport & {
  readonly symbol: string;
  readonly declaredIn: string;
  readonly fromZone: string;
  readonly declaredZone: string;
};

interface Reach {
  readonly declaredIn: string;
  readonly symbol: string;
  readonly zones: Set<string>;
  readonly files: Set<string>;
}

const crosses = (edge: ResolvedImport, borrowers: ReadonlySet<string>): edge is Crossing => {
  if (edge.kind === "type" || edge.symbol === null || edge.declaredIn === null) return false;
  if (edge.fromZone === null || edge.declaredZone === null) return false;
  return edge.fromZone !== edge.declaredZone && !borrowers.has(edge.fromZone);
};

const gather = (imports: readonly ResolvedImport[], borrowers: ReadonlySet<string>): Map<string, Reach> => {
  const seen = new Map<string, Reach>();

  for (const edge of imports) {
    if (!crosses(edge, borrowers)) continue;

    const key = `${edge.declaredIn}\0${edge.symbol}`;
    const found = seen.get(key);
    if (found === undefined) {
      seen.set(key, {
        declaredIn: edge.declaredIn,
        symbol: edge.symbol,
        zones: new Set([edge.fromZone]),
        files: new Set([edge.from]),
      });
    } else {
      found.zones.add(edge.fromZone);
      found.files.add(edge.from);
    }
  }

  return seen;
};

export function colocationClaim(consumesOnlyZones: readonly string[]): Claim {
  const borrowers = new Set(consumesOnlyZones);

  return {
    name: "no-value-is-declared-away-from-its-only-consumer",
    guidance: GUIDANCE,
    check: ({ project }): readonly Finding[] =>
      [...gather(project.imports(), borrowers).values()]
        .filter((reach) => reach.zones.size === 1)
        .sort((left, right) => (left.declaredIn < right.declaredIn ? -1 : 1))
        .map((reach) => {
          const only = [...reach.zones][0] ?? "";
          const where =
            reach.files.size === 1
              ? project.relative([...reach.files][0] ?? "")
              : `${only} (${reach.files.size} files)`;

          return {
            severity: "error" as const,
            message: `declares ${reach.symbol}, used only by ${where}`,
            file: reach.declaredIn,
            start: null,
          };
        }),
  };
}
