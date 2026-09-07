import type { ResolvedImport } from "../project/model.ts";
import type { Finding } from "../report/model.ts";
import type { Claim } from "./model.ts";

const GUIDANCE =
  "A zone exports a value that exactly one file in another zone uses, so the seam it crosses carries nothing anyone else needs. Move it into the file that uses it. A second consumer arriving later is a reason to move it back then, not a reason to leave it where it is now. Type-only edges are not reported, because a type can be used through a value without ever being imported. Declaring the consumer's zone as `wiring` silences this, and is honest only when that zone really is a composition root.";

type Crossing = ResolvedImport & {
  readonly symbol: string;
  readonly declaredIn: string;
  readonly fromZone: string;
  readonly declaredZone: string;
};

interface Lonely {
  readonly declaredIn: string;
  readonly symbol: string;
  readonly consumers: Set<string>;
}

const crosses = (edge: ResolvedImport, wiring: ReadonlySet<string>): edge is Crossing => {
  if (edge.kind === "type" || edge.symbol === null || edge.declaredIn === null) return false;
  if (edge.fromZone === null || edge.declaredZone === null) return false;
  return edge.fromZone !== edge.declaredZone && !wiring.has(edge.fromZone);
};

const gather = (imports: readonly ResolvedImport[], wiring: ReadonlySet<string>): Map<string, Lonely> => {
  const seen = new Map<string, Lonely>();

  for (const edge of imports) {
    if (!crosses(edge, wiring)) continue;

    const key = `${edge.declaredIn}\0${edge.symbol}`;
    const found = seen.get(key);
    if (found === undefined) {
      seen.set(key, { declaredIn: edge.declaredIn, symbol: edge.symbol, consumers: new Set([edge.from]) });
    } else {
      found.consumers.add(edge.from);
    }
  }

  return seen;
};

export function colocationClaim(wiringZones: readonly string[]): Claim {
  const wiring = new Set(wiringZones);

  return {
    name: "no-value-is-declared-away-from-its-only-consumer",
    guidance: GUIDANCE,
    check: ({ project }): readonly Finding[] =>
      [...gather(project.imports(), wiring).values()]
        .filter((lonely) => lonely.consumers.size === 1)
        .sort((left, right) => (left.declaredIn < right.declaredIn ? -1 : 1))
        .map((lonely) => ({
          severity: "error" as const,
          message: `declares ${lonely.symbol}, used only by ${project.relative([...lonely.consumers][0] ?? "")}`,
          file: lonely.declaredIn,
          start: null,
        })),
  };
}
