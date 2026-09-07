import { relative, sep } from "node:path";
import picomatch from "picomatch";
import type { DeadPattern, ZoneAssignment, ZoneDefinition } from "./model.js";

export interface AssignZonesInput {
  readonly root: string;
  readonly files: readonly string[];
  readonly zones: readonly ZoneDefinition[];
}

const toPosix = (path: string): string => (sep === "/" ? path : path.split(sep).join("/"));

export function assignZones({ root, files, zones }: AssignZonesInput): ZoneAssignment {
  const matchers = zones.map((zone) => ({
    name: zone.name,
    patterns: zone.patterns.map((pattern) => ({ pattern, isMatch: picomatch(pattern, { dot: true }) })),
  }));

  const assigned = new Map<string, string>();
  const filesByZone = new Map<string, string[]>(zones.map((zone) => [zone.name, []]));
  const unclassified: string[] = [];
  const livePatterns = new Set<string>();

  for (const file of files) {
    const candidate = toPosix(relative(root, file));
    const zone = matchers.find((entry) =>
      entry.patterns.some((matcher) => {
        if (!matcher.isMatch(candidate)) return false;
        livePatterns.add(`${entry.name} ${matcher.pattern}`);
        return true;
      }),
    );

    if (zone === undefined) {
      unclassified.push(file);
      continue;
    }
    assigned.set(file, zone.name);
    filesByZone.get(zone.name)?.push(file);
  }

  const deadPatterns: DeadPattern[] = [];
  for (const entry of matchers) {
    for (const matcher of entry.patterns) {
      if (!livePatterns.has(`${entry.name} ${matcher.pattern}`)) {
        deadPatterns.push({ zone: entry.name, pattern: matcher.pattern });
      }
    }
  }

  return {
    zoneOf: (path) => assigned.get(path) ?? null,
    declaredNames: zones.map((zone) => zone.name),
    filesIn: (zone) => filesByZone.get(zone) ?? [],
    unclassified,
    emptyZones: zones.map((zone) => zone.name).filter((name) => (filesByZone.get(name) ?? []).length === 0),
    deadPatterns,
  };
}
