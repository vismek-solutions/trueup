import type { Project } from "../project/model.ts";
import type { Claim } from "./model.ts";

const GUIDANCE = `These zones import each other in a cycle, so none can be read, tested or moved alone.

Do this:
- Decide which zone owns the concept they share, and give the rest a one-way dependency on it.
- If no zone owns it, move it to a new zone they may all reach.

Not the fix: adding a boundary rule. The imports are what has to change.`;

type Reaches = ReadonlyMap<string, ReadonlySet<string>>;

const reachesOf = (project: Project): Reaches => {
  const reaches = new Map<string, Set<string>>();

  for (const entry of project.imports()) {
    const { fromZone, declaredZone } = entry;
    if (fromZone === null || declaredZone === null || fromZone === declaredZone) continue;

    const targets = reaches.get(fromZone) ?? new Set<string>();
    targets.add(declaredZone);
    reaches.set(fromZone, targets);
  }

  return reaches;
};

const reachedFrom = (start: string, reaches: Reaches): ReadonlySet<string> => {
  const seen = new Set<string>();
  const pending = [...(reaches.get(start) ?? [])];

  while (pending.length > 0) {
    const zone = pending.pop();
    if (zone === undefined || seen.has(zone)) continue;
    seen.add(zone);
    pending.push(...(reaches.get(zone) ?? []));
  }

  return seen;
};

const cyclesIn = (reaches: Reaches): string[][] => {
  const closure = new Map([...reaches.keys()].map((zone) => [zone, reachedFrom(zone, reaches)]));
  const looping = [...closure]
    .filter(([zone, reached]) => reached.has(zone))
    .map(([zone]) => zone)
    .sort();

  const cycles: string[][] = [];
  const grouped = new Set<string>();

  for (const zone of looping) {
    if (grouped.has(zone)) continue;

    const cycle = looping.filter(
      (other) => closure.get(zone)?.has(other) === true && closure.get(other)?.has(zone) === true,
    );
    for (const member of cycle) grouped.add(member);
    cycles.push(cycle);
  }

  return cycles;
};

const listed = (zones: readonly string[]): string =>
  `${zones.slice(0, -1).join(", ")} and ${zones[zones.length - 1] ?? ""}`;

export const cycleClaim: Claim = {
  name: "no-zones-form-a-cycle",
  check: ({ project }) => ({
    findings: cyclesIn(reachesOf(project)).map((cycle) => ({
      severity: "error" as const,
      message: `zones ${listed(cycle)} form an import cycle`,
      file: null,
      start: null,
    })),
    guidance: GUIDANCE,
  }),
};
