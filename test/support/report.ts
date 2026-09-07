import type { RunnerOutcome } from "../../src/ports/runner.ts";
import type { ClaimResult, Finding, Report } from "../../src/report/model.ts";

export const claimIn = (report: Report, claim: string): ClaimResult | undefined =>
  report.claims.find((entry) => entry.claim === claim);

export const findingsIn = (report: Report, claim: string): readonly Finding[] =>
  claimIn(report, claim)?.findings ?? [];

export const messagesIn = (report: Report, claim: string): string[] =>
  findingsIn(report, claim).map((finding) => finding.message);

export const findingsOf = (outcome: RunnerOutcome) => (outcome.kind === "findings" ? outcome.findings : []);

export const reasonOf = (outcome: RunnerOutcome): string => (outcome.kind === "failed" ? outcome.reason : "");
