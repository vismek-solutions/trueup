export { defineConfig, defineMember, type ArchitectureConfig, type MemberConfig } from "./config/model.ts";
export { defineRule, type Rule } from "./claims/custom.ts";
export type { BoundaryRule, EdgeAnchor } from "./claims/boundary.ts";
export type { SeamRule } from "./claims/seam.ts";
export type { IsolationRule } from "./claims/isolation.ts";
export type { ImportQuery, Issue, Project, ResolvedImport } from "./project/model.ts";
export type { Vocabulary } from "./lexicon/model.ts";
export type { Mention, MentionForm, BindingKind } from "./ports/module-record.ts";
export type { ZoneDefinition } from "./zones/model.ts";
export type { Finding, Report, Severity } from "./report/model.ts";
export { analyze, check, type AnalyzeOptions, type CheckOptions } from "./compose.ts";
export {
  inspect,
  placementOf,
  type InspectOptions,
  type Placement,
  type PlacementInput,
} from "./compose.ts";
export { consumersOf } from "./graph/model.ts";
export { COMMAND_TOKEN, DEFAULT_COMMAND } from "./report/invocation.ts";
export { EXIT_CLEAN, EXIT_ERRORS, EXIT_NO_CONFIG, EXIT_STALE_BASELINE } from "./cli/command.ts";
export type { Baseline, BaselineEntry } from "./ports/baseline.ts";
export type { Runner, RunnerFinding, RunnerOutcome } from "./ports/runner.ts";
export type { ChangeSet, Changes, FileChange } from "./ports/changes.ts";
export type { ReviewBudget } from "./claims/review/budget.ts";
export {
  fallowRunner,
  DEFAULT_FALLOW_CATEGORIES,
  FALLOW_CATEGORIES,
  type FallowRunnerOptions,
} from "./adapters/fallow-runner.ts";
export { eslintRunner, type EslintRunnerOptions } from "./adapters/eslint-runner.ts";
export { oxlintRunner, type OxlintRunnerOptions } from "./adapters/oxlint-runner.ts";
export { biomeRunner, DEFAULT_MAX_DIAGNOSTICS, type BiomeRunnerOptions } from "./adapters/biome-runner.ts";
export { RUNNERS_RAN_CLAIM } from "./claims/delegated.ts";
export { decideOnProposal } from "./guard/decide.ts";
export type { Decision, Proposal, Verdict } from "./ports/proposal.ts";
export type { Protection, ProtectionRule } from "./ports/protection.ts";
export type { Overlay } from "./compose.ts";
export { applyBaseline, baselineOf, STALE_CLAIM } from "./ratchet/apply.ts";
export type { RatchetResult } from "./ratchet/model.ts";
