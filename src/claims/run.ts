import { coverageOf } from "../report/coverage.ts";
import type { Report } from "../report/model.ts";
import type { CheckContext, Claim } from "./model.ts";

export function runClaims(claims: readonly Claim[], context: CheckContext): Report {
  return {
    claims: claims.map((claim) => ({
      claim: claim.name,
      guidance: claim.guidance,
      findings: claim.check(context),
    })),
    coverage: coverageOf(context),
  };
}
