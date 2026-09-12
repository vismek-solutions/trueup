import { dirname } from "node:path";
import type { Project } from "../../project/model.ts";
import type { Finding } from "../../report/model.ts";
import type { Claim } from "../model.ts";
import { type SymbolReach, everyConsumer } from "./reach.ts";
import { FOR_TESTS, INTERNALS } from "./remedies.ts";

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

const reachingInternal = (reach: SymbolReach, project: Project, tests: ReadonlySet<string>): readonly Finding[] => {
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
    check: ({ project }) => {
      if (tests.size === 0) return { findings: [NO_TEST_ZONE], guidance: INTERNALS };
      const published = publishedBy(project, apiZones);

      const findings: readonly Finding[] = everyConsumer(project.imports())
        .filter((reach) => !opaque.has(reach.declaredZone) && !published.has(reach.symbol))
        .flatMap((reach) => reachingInternal(reach, project, tests));

      return { findings, guidance: INTERNALS };
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
    check: ({ project }) => {
      const published = publishedBy(project, apiZones);

      const findings: readonly Finding[] = everyConsumer(project.imports())
        .filter((reach) => !tests.has(reach.declaredZone) && !published.has(reach.symbol))
        .filter((reach) => [...reach.zones].every((zone) => tests.has(zone)))
        .map((reach) => ({
          severity: "error" as const,
          message: `exports ${reach.symbol}, which only tests use`,
          file: reach.declaredIn,
          start: null,
          symbols: [reach.symbol],
        }));

      return { findings, guidance: FOR_TESTS };
    },
  };
}
