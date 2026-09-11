import { dirname } from "node:path";
import type { Project, ResolvedImport } from "../../project/model.ts";
import type { Finding } from "../../report/model.ts";
import type { Claim } from "../model.ts";
import { FOR_TESTS, INTERNALS, PLACEMENT } from "./remedies.ts";

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

interface Reported {
  readonly reach: Reach;
  readonly owner: string;
}

const reportedIn = (project: Project, roles: ReadonlySet<string>): readonly Reported[] =>
  acrossZones(project.imports()).flatMap((reach) => {
    const owners = [...reach.zones].filter((zone) => !roles.has(zone));
    const only = owners[0];
    return owners.length === 1 && only !== undefined ? [{ reach, owner: only }] : [];
  });

const byFile = (reported: readonly Reported[]): [string, Reported[]][] => {
  const groups = new Map<string, Reported[]>();

  for (const entry of reported) {
    const found = groups.get(entry.reach.declaredIn);
    if (found === undefined) groups.set(entry.reach.declaredIn, [entry]);
    else found.push(entry);
  }

  return [...groups];
};

const zonesReadingEach = (project: Project, roles: ReadonlySet<string>): Map<string, Set<string>> => {
  const readers = new Map<string, Set<string>>();

  for (const reach of everyConsumer(project.imports())) {
    const zones = readers.get(reach.declaredIn) ?? new Set<string>();
    for (const zone of reach.zones) if (!roles.has(zone)) zones.add(zone);
    readers.set(reach.declaredIn, zones);
  }

  return readers;
};

const consumerOf = (group: readonly Reported[], owner: string, project: Project): string => {
  const files = [
    ...new Set(group.flatMap(({ reach }) => [...reach.files])),
  ].filter((file) => project.zoneOf(file) === owner);
  const only = files[0];

  return files.length === 1 && only !== undefined ? project.relative(only) : `${owner} (${files.length} files)`;
};

const misplaced = (
  group: readonly Reported[],
  project: Project,
  readBy: ReadonlySet<string>,
): readonly Finding[] => {
  const first = group[0];
  if (first === undefined) return [];

  const owners = new Set(group.map(({ owner }) => owner));
  const wholeFile = owners.size === 1 && readBy.size === 1 && readBy.has(first.owner);
  if (group.length === 1 || !wholeFile) {
    return group.map(({ reach, owner }) => ({
      severity: "error" as const,
      message: `declares ${reach.symbol}, used only by ${consumerOf([{ reach, owner }], owner, project)}`,
      file: reach.declaredIn,
      start: null,
      symbols: [reach.symbol],
      group: reach.declaredIn,
    }));
  }

  const where = consumerOf(group, first.owner, project);
  return [
    {
      severity: "error" as const,
      message: `declares ${group.length} exports, all used only by ${where}, so the file is in the wrong directory rather than the declarations`,
      file: first.reach.declaredIn,
      start: null,
      symbols: group.map(({ reach }) => reach.symbol).sort(),
      group: first.reach.declaredIn,
    },
  ];
};

export function colocationClaim(roleZones: readonly string[]): Claim {
  const roles = new Set(roleZones);

  return {
    name: "no-value-is-declared-away-from-its-only-consumer",
    guidance: PLACEMENT,
    check: ({ project }): readonly Finding[] => {
      const readBy = zonesReadingEach(project, roles);

      return byFile(reportedIn(project, roles)).flatMap(([file, group]) =>
        misplaced(group, project, readBy.get(file) ?? new Set()),
      );
    },
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
    symbols: [reach.symbol],
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
          symbols: [reach.symbol],
        }));
    },
  };
}
