import type { Report } from "./model.ts";

export const COMMAND_TOKEN = "{acs}";

export const DEFAULT_COMMAND = "acs";

export const withCommand = (report: Report, command: string): Report => ({
  claims: report.claims.map((claim) => ({
    ...claim,
    guidance: claim.guidance.replaceAll(COMMAND_TOKEN, command),
  })),
  coverage: report.coverage,
});
