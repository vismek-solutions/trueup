import type { Report } from "./model.ts";

export const COMMAND_TOKEN = "{trueline}";

export const DEFAULT_COMMAND = "trueline";

export const withCommand = (report: Report, command: string): Report => ({
  ...report,
  claims: report.claims.map((claim) => ({
    ...claim,
    guidance: claim.guidance.replaceAll(COMMAND_TOKEN, command),
  })),
});
