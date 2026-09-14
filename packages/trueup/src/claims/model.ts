import type { SymbolGraph } from "../graph/model.ts";
import type { Lexicon } from "../lexicon/model.ts";
import type { Project } from "../project/model.ts";
import type { Finding } from "../report/model.ts";
import type { ZoneAssignment } from "../zones/model.ts";

export interface CheckContext {
  readonly root: string;
  readonly graph: SymbolGraph;
  readonly zones: ZoneAssignment;
  readonly lexicon: Lexicon;
  readonly project: Project;
}

export interface Verdict {
  readonly findings: readonly Finding[];
  readonly guidance: string;
}

export interface Claim {
  readonly name: string;
  readonly setting?: string | undefined;
  readonly onePerFile?: boolean | undefined;
  readonly check: (context: CheckContext) => Verdict;
}
