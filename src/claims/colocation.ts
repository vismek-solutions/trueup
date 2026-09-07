import type { ResolvedImport } from "../project/model.ts";
import type { Finding } from "../report/model.ts";
import type { Claim } from "./model.ts";

const PLACEMENT =
  "A zone exports a value that only one other zone uses, so the seam it crosses carries nothing a second caller needs — a symbol in a shared package that one consumer uses is not shared, it is that consumer's code in the wrong place. Move it to the zone that uses it. A second consumer arriving later is a reason to move it back then, not a reason to leave it now. Type-only edges are not reported, because a type can be used through a value without ever being imported. Giving a zone a role silences it as a consumer, and is honest only for a zone that never owns what it uses.";

const FOR_TESTS =
  "Nothing outside the tests uses this export, so it is public only so a test can reach in. Reach the behaviour through the surface production actually calls, and the export can go back to being private. If the piece genuinely deserves its own test, that is a sign it wants to be its own module with a real caller, not a widened surface on this one. A helper that exists purely to serve tests belongs in a zone with the tests role, not in the source it props up. Something a package publishes belongs in a zone with the api role, whose consumers this analysis cannot see. Adding a production caller to satisfy this check is the one fix that makes the codebase worse.";

type Crossing = ResolvedImport & {
  readonly symbol: string;
  readonly declaredIn: string;
  readonly fromZone: string;
  readonly declaredZone: string;
};

interface Reach {
  readonly declaredIn: string;
  readonly declaredZone: string;
  readonly symbol: string;
  readonly zones: Set<string>;
  readonly files: Set<string>;
}

const crosses = (edge: ResolvedImport): edge is Crossing => {
  if (edge.kind === "type" || edge.symbol === null || edge.declaredIn === null) return false;
  if (edge.fromZone === null || edge.declaredZone === null) return false;
  return edge.fromZone !== edge.declaredZone;
};

const gather = (imports: readonly ResolvedImport[]): Reach[] => {
  const seen = new Map<string, Reach>();

  for (const edge of imports) {
    if (!crosses(edge)) continue;

    const key = `${edge.declaredIn}\0${edge.symbol}`;
    const found = seen.get(key);
    if (found === undefined) {
      seen.set(key, {
        declaredIn: edge.declaredIn,
        declaredZone: edge.declaredZone,
        symbol: edge.symbol,
        zones: new Set([edge.fromZone]),
        files: new Set([edge.from]),
      });
    } else {
      found.zones.add(edge.fromZone);
      found.files.add(edge.from);
    }
  }

  return [...seen.values()].sort((left, right) => (left.declaredIn < right.declaredIn ? -1 : 1));
};

export function colocationClaim(roleZones: readonly string[]): Claim {
  const roles = new Set(roleZones);

  return {
    name: "no-value-is-declared-away-from-its-only-consumer",
    guidance: PLACEMENT,
    check: ({ project }): readonly Finding[] =>
      gather(project.imports())
        .map((reach) => ({ reach, owners: [...reach.zones].filter((zone) => !roles.has(zone)) }))
        .filter(({ owners }) => owners.length === 1)
        .map(({ reach, owners }) => {
          const only = owners[0] ?? "";
          const inOnly = [...reach.files].filter((file) => project.zoneOf(file) === only);
          const where =
            inOnly.length === 1 ? project.relative(inOnly[0] ?? "") : `${only} (${inOnly.length} files)`;

          return {
            severity: "error" as const,
            message: `declares ${reach.symbol}, used only by ${where}`,
            file: reach.declaredIn,
            start: null,
          };
        }),
  };
}

export interface TestOnlyExportInput {
  readonly testZones: readonly string[];
  readonly apiZones: readonly string[];
}

export function testOnlyExportClaim({ testZones, apiZones }: TestOnlyExportInput): Claim {
  const tests = new Set(testZones);

  return {
    name: "no-export-exists-only-for-a-test",
    guidance: FOR_TESTS,
    check: ({ project }): readonly Finding[] => {
      const published = new Set(
        apiZones.flatMap((zone) => project.filesIn(zone)).flatMap((file) => project.exportsOf(file)),
      );

      return gather(project.imports())
        .filter((reach) => !tests.has(reach.declaredZone) && !published.has(reach.symbol))
        .filter((reach) => [...reach.zones].every((zone) => tests.has(zone)))
        .map((reach) => ({
          severity: "error" as const,
          message: `exports ${reach.symbol}, which only tests use`,
          file: reach.declaredIn,
          start: null,
        }));
    },
  };
}
