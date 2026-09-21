import type { Runner, RunnerFinding, RunnerOutcome } from "../ports/runner.ts";
import type { ClaimResult, Finding } from "../report/model.ts";

export const RUNNERS_RAN_CLAIM = "every-delegated-tool-ran";

const RAN_GUIDANCE = `A configured analyzer did not run, so the checks it owns did not happen and their absence is not a pass.

Do this:
- Fix the command.
- Or install the tool.
- Or remove the runner from the config, if the project no longer uses it.`;

const findingGuidance = (runner: string): string =>
  `Reported by ${runner}, which this project delegates to. Consult ${runner} for what the finding means; the rules here did not produce it.`;

const claimNameOf = (runner: string, category: string): string => `${runner}/${category}`;

const reasonOf = (answer: PromiseSettledResult<RunnerOutcome> | undefined): string => {
  if (answer === undefined || answer.status !== "rejected") return "it produced no outcome";
  return answer.reason instanceof Error ? answer.reason.message : String(answer.reason);
};

export async function runDelegated(
  runners: readonly Runner[],
  root: string,
): Promise<readonly ClaimResult[]> {
  if (runners.length === 0) return [];

  const failures: Finding[] = [];
  const byClaim = new Map<string, { readonly runner: string; readonly findings: RunnerFinding[] }>();

  const settled = await Promise.allSettled(runners.map((runner) => runner.run(root)));

  for (const [at, runner] of runners.entries()) {
    const answer = settled[at];
    const outcome: RunnerOutcome =
      answer === undefined || answer.status === "rejected"
        ? { kind: "failed", reason: reasonOf(answer) }
        : answer.value;

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
