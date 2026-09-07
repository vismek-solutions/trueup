import type { Verdict } from "./proposal.ts";

export interface ProtectionRule {
  readonly paths?: readonly string[] | undefined;
  readonly decision?: Exclude<Verdict, "allow"> | undefined;
}

export type Protection = readonly string[] | ProtectionRule;
