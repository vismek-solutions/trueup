import type { CheckContext, Claim } from "../claims/model.js";
import { coverageOf } from "./coverage.js";
import type { Report } from "./model.js";

export function runClaims(claims: readonly Claim[], context: CheckContext): Report {
  return {
    claims: claims.map((claim) => ({ claim: claim.name, findings: claim.check(context) })),
    coverage: coverageOf(context),
  };
}
