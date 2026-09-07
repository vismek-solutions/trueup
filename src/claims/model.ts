import type { SymbolGraph } from "../graph/model.js";
import type { Finding } from "../report/model.js";
import type { ZoneAssignment } from "../zones/model.js";

export interface CheckContext {
  readonly root: string;
  readonly graph: SymbolGraph;
  readonly zones: ZoneAssignment;
}

export interface Claim {
  readonly name: string;
  readonly check: (context: CheckContext) => readonly Finding[];
}
