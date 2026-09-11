import { baselinePathIn, readBaseline } from "../adapters/baseline-file.ts";
import { contextFor, modeOf, requestFrom, verdictFor } from "../adapters/claude-code-hook.ts";
import { readSource } from "../adapters/node-files.ts";
import { parseModule } from "../adapters/oxc-parse.ts";
import { check, placementOf } from "../compose.ts";
import { findConfig, resolveInclude } from "../config/load.ts";
import type { ResolvedConfig } from "../config/model.ts";
import { decideOnProposal } from "../guard/decide.ts";
import { protectionOf } from "../guard/protected.ts";
import type { Protection } from "../ports/protection.ts";
import type { Decision, HookRequest } from "../ports/proposal.ts";
import { applyBaseline } from "../ratchet/apply.ts";
import { DEFAULT_COMMAND, withCommand } from "../report/invocation.ts";
import type { Report } from "../report/model.ts";
import { type Analysable, rulebookAt, unanalysed } from "./preamble.ts";

export interface RunGuardInput {
  readonly cwd: string;
  readonly stdin: string;
  readonly write: (line: string) => void;
}

interface Site {
  readonly root: string;
  readonly config: ResolvedConfig;
}

interface Rulebook {
  readonly root: string;
  readonly rulebooks: readonly string[];
  readonly baseline: string;
  readonly protect: Protection | undefined;
  readonly mode: string | null;
}

const targetOf = (request: HookRequest): string | null =>
  request.kind === "propose" ? request.proposal.path : request.path;

const spreadIn = (request: HookRequest): boolean => request.kind === "review" && request.spread;

const overlayOf = (request: HookRequest): Map<string, string> =>
  request.kind === "propose" ? new Map([[request.proposal.path, request.proposal.text]]) : new Map();

const withReach = (decision: Decision, path: string | null, { root, config }: Site) => {
  if (decision.verdict === "allow" || path === null) return decision;

  const placement = placementOf({ root, path, zones: config.zones, boundaries: config.boundaries });
  if (placement.zone === null) return decision;

  const footer = `${placement.zone} may reach ${placement.mayReach.join(" · ")}`;
  return { ...decision, reasons: [...decision.reasons, footer] };
};

interface Answer {
  readonly request: HookRequest;
  readonly decision: Decision;
  readonly spread: boolean;
  readonly notes?: readonly string[] | undefined;
}

const answerTo = ({ request, decision, spread, notes = [] }: Answer): string | null =>
  request.kind === "propose" ? verdictFor(decision) : contextFor(decision, spread, notes);

const noticesIn = (report: Report): string[] =>
  report.claims.flatMap((claim) =>
    claim.findings
      .filter((finding) => finding.severity === "warning" && finding.file === null)
      .map((finding) => `${claim.claim}\n  ${finding.message}`),
  );

const refusalOver = (request: HookRequest, path: string | null, rulebook: Rulebook): string | null => {
  if (path === null) return null;

  const decision = protectionOf({
    root: rulebook.root,
    path,
    always: [...rulebook.rulebooks, rulebook.baseline],
    protect: rulebook.protect,
    mode: rulebook.mode,
  });

  return decision.verdict === "allow" ? null : answerTo({ request, decision, spread: false });
};

const ALREADY = " — already unresolved before this edit";

const importedBefore = (path: string): ReadonlySet<string> => {
  try {
    return new Set(parseModule(path, readSource(path)).imports.map((entry) => entry.specifier));
  } catch {
    return new Set<string>();
  }
};

const markingPriorFailures = (report: Report, request: HookRequest, path: string | null): Report => {
  if (request.kind !== "propose" || path === null) return report;

  const before = importedBefore(path);
  if (before.size === 0) return report;

  return {
    ...report,
    claims: report.claims.map((claim) => ({
      ...claim,
      findings: claim.findings.map((finding) =>
        finding.file === path && finding.specifier !== undefined && before.has(finding.specifier)
          ? { ...finding, message: `${finding.message}${ALREADY}` }
          : finding,
      ),
    })),
  };
};

const analysed = (site: Analysable, path: string | null): boolean =>
  path === null || unanalysed(site, path) === null;

const arrivingAt = (request: HookRequest, path: string | null): boolean => {
  if (request.kind !== "propose" || path === null) return false;

  try {
    readSource(path);
    return false;
  } catch {
    return true;
  }
};

export async function runGuard({ cwd, stdin, write }: RunGuardInput): Promise<number> {
  let payload: unknown;
  try {
    payload = JSON.parse(stdin);
  } catch {
    return 0;
  }

  const found = findConfig(cwd);
  if (found === null) return 0;

  const loaded = await rulebookAt(found, write);
  if (loaded === null) return 0;

  const { config, root, memberConfigs } = loaded;
  const request = requestFrom(payload, root);
  if (request === null) return 0;

  const rulebooks = [found, ...memberConfigs];
  const target = targetOf(request);
  const baseline = baselinePathIn(root);
  const refusal = refusalOver(request, target, {
    root,
    rulebooks,
    baseline,
    protect: config.protect,
    mode: modeOf(payload),
  });

  if (refusal !== null) {
    write(refusal);
    return 0;
  }

  const spread = spreadIn(request);
  const checked = spread ? null : target;

  const roots = resolveInclude(root, config.include);
  if (!analysed({ root, config, roots }, checked)) return 0;

  const report = withCommand(
    check({
      root,
      roots,
      zones: config.zones,
      boundaries: config.boundaries,
      seams: config.seams,
      maxFilesPerDirectory: config.maxFilesPerDirectory,
      duplication: config.duplication,
      reviewable: config.reviewable,
      changes: config.changes,
      isolate: config.isolate,
      colocation: config.colocation,
      readerships: config.readerships,
      testInternals: config.testInternals,
      rules: config.rules,
      extensions: config.extensions,
      externals: config.externals,
      ignoreDirectories: config.ignoreDirectories,
      ignoreFiles: rulebooks,
      overlay: overlayOf(request),
    }),
    config.command ?? DEFAULT_COMMAND,
  );

  const recorded = readBaseline(baseline);
  const { report: effective } = applyBaseline({ report, baseline: recorded, root });

  const marked = markingPriorFailures(effective, request, checked);
  const decision = decideOnProposal({
    report: marked,
    path: checked,
    root,
    arriving: arrivingAt(request, checked),
  });
  const reach = withReach(decision, checked, { root, config });
  const output = answerTo({ request, decision: reach, spread, notes: noticesIn(effective) });
  if (output !== null) write(output);
  return 0;
}
