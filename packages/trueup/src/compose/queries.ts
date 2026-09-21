import { reachedBy, sharedHomes, type BoundaryRule } from "../claims/boundary.ts";
import {
  siblingsFor,
  type SiblingPlacement,
  type SiblingsInput,
} from "../claims/isolation/siblings.ts";
import { sizeOf, type ChangeSize, type ReviewBudget } from "../claims/review/budget.ts";
import { ungovernedFlows, type Ungoverned } from "../claims/ungoverned.ts";
import type { FileChange } from "../ports/changes.ts";
import type { Project } from "../project/model.ts";
import { aboutName, type NameReport } from "../project/name.ts";
import { distributionsIn, type Distribution } from "../text/calibration.ts";
import type { TextSettings } from "../text/claims.ts";
import { assignZones } from "../zones/assign.ts";
import type { ZoneDefinition } from "../zones/model.ts";

export const ungovernedIn = (project: Project, boundaries: readonly BoundaryRule[]): Ungoverned =>
  ungovernedFlows(project, boundaries);

export const nameIn = (project: Project, file: string, name: string): NameReport =>
  aboutName(project, file, name);

export const siblingsIn = (input: SiblingsInput): readonly SiblingPlacement[] => siblingsFor(input);

export const calibrationIn = (project: Project, text: TextSettings): readonly Distribution[] =>
  distributionsIn(project, text);

export const changeSizeIn = (changed: readonly FileChange[], budget: ReviewBudget): ChangeSize =>
  sizeOf(changed, budget);

export interface Rulebook {
  readonly zones: readonly ZoneDefinition[];
  readonly boundaries: readonly BoundaryRule[];
}

export interface PlacementInput extends Rulebook {
  readonly root: string;
  readonly path: string;
}

export interface Reach {
  readonly mayReach: readonly string[];
  readonly mayNotReach: readonly string[];
}

export interface Placement extends Reach {
  readonly zone: string | null;
}

export interface ReachInput extends Rulebook {
  readonly zone: string;
}

export function reachOf({ zone, zones, boundaries }: ReachInput): Reach {
  const names = zones.map((entry) => entry.name);
  const mayReach = reachedBy(zone, { names, rules: boundaries });

  return { mayReach, mayNotReach: names.filter((name) => !mayReach.includes(name)) };
}

export interface HomesInput extends Rulebook {
  readonly needs: readonly string[];
  readonly readers: readonly string[];
}

export const homesFor = ({ needs, readers, zones, boundaries }: HomesInput): readonly string[] =>
  sharedHomes({ needs, readers, names: zones.map((entry) => entry.name), rules: boundaries });

export function placementOf({ root, path, zones, boundaries }: PlacementInput): Placement {
  const zone = assignZones({ root, files: [path], zones }).zoneOf(path);
  if (zone === null) return { zone: null, mayReach: [], mayNotReach: [] };

  return { zone, ...reachOf({ zone, zones, boundaries }) };
}
