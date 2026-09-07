import type { Runner, RunnerFinding } from "../ports/runner.ts";
import type { ClaimResult } from "../report/model.ts";

export const RUNNERS_RAN_CLAIM = "every-delegated-tool-ran";

const claimNameOf = (runner: string, category: string): string => `${runner}/${category}`;

export function runDelegated(runners: readonly Runner[], root: string): readonly ClaimResult[] {
  if (runners.length === 0) return [];

  const failures: ClaimResult["findings"][number][] = [];
  const byClaim = new Map<string, RunnerFinding[]>();

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
      if (existing === undefined) byClaim.set(name, [finding]);
      else existing.push(finding);
    }
  }

  const delegated: ClaimResult[] = [...byClaim.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([claim, findings]) => ({
      claim,
      findings: findings.map((finding) => ({
        severity: finding.severity,
        message: finding.message,
        file: finding.file,
        start: finding.start,
      })),
    }));

  return [{ claim: RUNNERS_RAN_CLAIM, findings: failures }, ...delegated];
}
