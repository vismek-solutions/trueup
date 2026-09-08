import { check } from "../../src/compose.ts";
import { loadConfig, resolveInclude } from "../../src/config/load.ts";
import type { RunnerOutcome } from "../../src/ports/runner.ts";
import type { ClaimResult, Finding, Report } from "../../src/report/model.ts";

export const reportForConfig = async (configPath: string): Promise<Report> => {
  const { config, root, memberConfigs } = await loadConfig(configPath);
  return check({
    root,
    roots: resolveInclude(root, config.include),
    ignoreFiles: [configPath, ...memberConfigs],
    ...config,
  });
};

export const claimIn = (report: Report, claim: string): ClaimResult | undefined =>
  report.claims.find((entry) => entry.claim === claim);

export const findingsIn = (report: Report, claim: string): readonly Finding[] =>
  claimIn(report, claim)?.findings ?? [];

export const messagesIn = (report: Report, claim: string): string[] =>
  findingsIn(report, claim).map((finding) => finding.message);

export const messagesFor = async (configPath: string, claim: string): Promise<string> =>
  messagesIn(await reportForConfig(configPath), claim).join(" · ");

export const findingsOf = (outcome: RunnerOutcome) => (outcome.kind === "findings" ? outcome.findings : []);

export const reasonOf = (outcome: RunnerOutcome): string => (outcome.kind === "failed" ? outcome.reason : "");
