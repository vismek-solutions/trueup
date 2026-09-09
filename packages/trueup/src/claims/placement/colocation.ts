import { dirname } from "node:path";
import type { Project, ResolvedImport } from "../../project/model.ts";
import type { Finding } from "../../report/model.ts";
import type { Claim } from "../model.ts";

const PLACEMENT =
  "A zone exports a value that only one other zone uses, so the seam it crosses carries nothing a second caller needs — a symbol in a shared package that one consumer uses is not shared, it is that consumer's code in the wrong place. The symbol is where the evidence is, not always where the defect is. Read the file first: when several of its exports are reported, or they serve one consumer between them, the file itself sits in the wrong directory, and moving the file closes every finding at once. For an export left over after that, ask whether the seam should carry it at all — a value the caller derives from an argument it hands the same collaborator belongs to that collaborator, which can derive it itself and leave the two nothing to disagree about. Moving the one declaration is the fix only when neither of those holds. A second consumer arriving later is a reason to move it back then, not a reason to leave it now. Type-only edges are not reported, because a type can be used through a value without ever being imported. Giving a zone a role silences it as a consumer, and is honest only for a zone that never owns what it uses.";

const INTERNALS =
  "A test reaches a symbol that nothing outside its own directory calls, so the test knows a decomposition none of the callers know. Fold that symbol into the neighbour that uses it and the behaviour is unchanged while the test breaks, which is what it means for a test to be bound to an implementation detail rather than to behaviour. Reach the behaviour through the surface the production callers already go through, and the split underneath is free to move. When that is genuinely too expensive — a handful of cases each needing their own fixture to drive from outside — the symbol is asking to become a module with a caller of its own, not a wider surface on the one it sits in. Widening that surface so the direct test becomes legitimate, or adding a production caller to justify it, both leave the codebase worse than the finding did. A zone with the wiring role is not reported, because a composition root has no internals to protect. Something the package publishes belongs in a zone with the api role, and is surface wherever it is declared.";

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

const usable = (edge: ResolvedImport): edge is Crossing => {
  if (edge.kind === "type" || edge.symbol === null || edge.declaredIn === null) return false;
  return edge.fromZone !== null && edge.declaredZone !== null;
};

const gather = (imports: readonly ResolvedImport[], keepSameZone: boolean): Reach[] => {
  const seen = new Map<string, Reach>();

  for (const edge of imports) {
    if (!usable(edge)) continue;
    if (!keepSameZone && edge.fromZone === edge.declaredZone) continue;

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

const acrossZones = (imports: readonly ResolvedImport[]): Reach[] => gather(imports, false);

const everyConsumer = (imports: readonly ResolvedImport[]): Reach[] => gather(imports, true);

export function colocationClaim(roleZones: readonly string[]): Claim {
  const roles = new Set(roleZones);

  return {
    name: "no-value-is-declared-away-from-its-only-consumer",
    guidance: PLACEMENT,
    check: ({ project }): readonly Finding[] =>
      acrossZones(project.imports())
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
            group: reach.declaredIn,
          };
        }),
  };
}

export interface TestInternalsInput {
  readonly testZones: readonly string[];
  readonly apiZones: readonly string[];
  readonly wiringZones: readonly string[];
}

const NO_TEST_ZONE: Finding = {
  severity: "warning",
  message: "no zone has the tests role, so there are no tests to hold to a surface",
  file: null,
  start: null,
};

const reachingInternal = (reach: Reach, project: Project, tests: ReadonlySet<string>): readonly Finding[] => {
  const consumers = [...reach.files].filter((file) => file !== reach.declaredIn);
  const inTests = consumers.filter((file) => tests.has(project.zoneOf(file) ?? ""));
  const inside = consumers.filter((file) => !tests.has(project.zoneOf(file) ?? ""));
  if (inTests.length === 0 || inside.length === 0) return [];

  const unit = dirname(reach.declaredIn);
  if (inside.some((file) => dirname(file) !== unit)) return [];

  const calls = inside
    .map((file) => project.relative(file))
    .sort()
    .join(", ");
  const where = project.relative(reach.declaredIn);

  return inTests.sort().map((file) => ({
    severity: "error" as const,
    message: `reaches ${reach.symbol}, an internal of ${where} that only ${calls} calls`,
    file,
    start: null,
    group: file,
  }));
};

const publishedBy = (project: Project, apiZones: readonly string[]): ReadonlySet<string> =>
  new Set(apiZones.flatMap((zone) => project.filesIn(zone)).flatMap((file) => project.exportsOf(file)));

export function testInternalsClaim({ testZones, apiZones, wiringZones }: TestInternalsInput): Claim {
  const tests = new Set(testZones);
  const opaque = new Set([...testZones, ...wiringZones]);

  return {
    name: "no-test-reaches-an-internal",
    guidance: INTERNALS,
    check: ({ project }): readonly Finding[] => {
      if (tests.size === 0) return [NO_TEST_ZONE];
      const published = publishedBy(project, apiZones);

      return everyConsumer(project.imports())
        .filter((reach) => !opaque.has(reach.declaredZone) && !published.has(reach.symbol))
        .flatMap((reach) => reachingInternal(reach, project, tests));
    },
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
      const published = publishedBy(project, apiZones);

      return everyConsumer(project.imports())
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
