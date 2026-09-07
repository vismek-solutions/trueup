import type { SymbolGraph } from "../graph/model.ts";
import type { Finding } from "../report/model.ts";
import type { ZoneAssignment } from "../zones/model.ts";

export interface CheckContext {
  readonly root: string;
  readonly graph: SymbolGraph;
  readonly zones: ZoneAssignment;
}

export interface Claim {
  readonly name: string;
  readonly check: (context: CheckContext) => readonly Finding[];
}
