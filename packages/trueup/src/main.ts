export {
  analyze,
  inspect,
  type AnalyzeOptions,
  type InspectOptions,
  type Overlay,
} from "./compose/analysis.ts";
export { check, type CheckOptions } from "./compose/check.ts";
export {
  calibrationIn,
  changeSizeIn,
  homesFor,
  nameIn,
  placementOf,
  reachOf,
  siblingsIn,
  ungovernedIn,
  type HomesInput,
  type Placement,
  type PlacementInput,
  type Rulebook,
} from "./compose/queries.ts";
