import type { Runner, RunnerFinding } from "../ports/runner.ts";
import type { ClaimResult, Finding } from "../report/model.ts";

export const RUNNERS_RAN_CLAIM = "every-delegated-tool-ran";

const RAN_GUIDANCE =
  "A configured analyzer did not run, so the checks it owns did not happen and their absence is not a pass. Fix the command, install the tool, or remove the runner from the config.";

const findingGuidance = (runner: string): string =>
  `Reported by ${runner}, which this project delegates to. Consult ${runner} for what the finding means; the rules here did not produce it.`;

const claimNameOf = (runner: string, category: string): string => `${runner}/${category}`;

export function runDelegated(runners: readonly Runner[], root: string): readonly ClaimResult[] {
  if (runners.length === 0) return [];

  const failures: Finding[] = [];
  const byClaim = new Map<string, { readonly runner: string; readonly findings: RunnerFinding[] }>();

  for (const runner of runners) {
    const outcome = runner.run(root);

    if (outcome.kind === "failed") {
      failures.push({
        severity: "error",
        message: `${runner.name} did not run: ${outcome.reason}`,
        file: null,
        start: null,
      });
      continue;
    }

    for (const finding of outcome.findings) {
      const name = claimNameOf(runner.name, finding.category);
      const existing = byClaim.get(name);
      if (existing === undefined) byClaim.set(name, { runner: runner.name, findings: [finding] });
      else existing.findings.push(finding);
    }
  }

  const delegated: ClaimResult[] = [...byClaim.entries()]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([claim, { runner, findings }]) => ({
      claim,
      guidance: findingGuidance(runner),
      findings: findings.map((finding) => ({
        severity: finding.severity,
        message: finding.message,
        file: finding.file,
        start: finding.start,
        ...(finding.group === undefined ? {} : { group: finding.group }),
      })),
    }));

  return [{ claim: RUNNERS_RAN_CLAIM, guidance: RAN_GUIDANCE, findings: failures }, ...delegated];
}
