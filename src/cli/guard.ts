import { extname, relative, sep } from "node:path";
import { baselinePathIn, readBaseline } from "../adapters/baseline-file.ts";
import { contextFor, modeOf, requestFrom, verdictFor } from "../adapters/claude-code-hook.ts";
import { IGNORED_DIRECTORIES, SOURCE_EXTENSIONS } from "../adapters/node-files.ts";
import { check, placementOf } from "../compose.ts";
import { findConfig, loadConfig, resolveInclude } from "../config/load.ts";
import type { ArchitectureConfig } from "../config/model.ts";
import { decideOnProposal } from "../guard/decide.ts";
import { protectionOf } from "../guard/protected.ts";
import type { Protection } from "../ports/protection.ts";
import type { Decision, HookRequest } from "../ports/proposal.ts";
import { applyBaseline } from "../ratchet/apply.ts";
import { DEFAULT_COMMAND, withCommand } from "../report/invocation.ts";

export interface RunGuardInput {
  readonly cwd: string;
  readonly stdin: string;
  readonly write: (line: string) => void;
}

interface Site {
  readonly root: string;
  readonly config: ArchitectureConfig;
}

interface Rulebook {
  readonly root: string;
  readonly rulebooks: readonly string[];
  readonly baseline: string;
  readonly protect: Protection | undefined;
  readonly mode: string | null;
}

const under = (roots: readonly string[], path: string): boolean =>
  roots.some((root) => path === root || path.startsWith(`${root}${sep}`));

const targetOf = (request: HookRequest): string | null =>
  request.kind === "propose" ? request.proposal.path : request.path;

const overlayOf = (request: HookRequest): Map<string, string> =>
  request.kind === "propose" ? new Map([[request.proposal.path, request.proposal.text]]) : new Map();

const withReach = (decision: Decision, path: string | null, { root, config }: Site) => {
  if (decision.verdict === "allow" || path === null) return decision;

  const placement = placementOf({ root, path, zones: config.zones, boundaries: config.boundaries ?? [] });
  if (placement.zone === null) return decision;

  const footer = `${placement.zone} may reach ${placement.mayReach.join(" · ")}`;
  return { ...decision, reasons: [...decision.reasons, footer] };
};

const answerTo = (request: HookRequest, decision: Decision): string | null =>
  request.kind === "propose" ? verdictFor(decision) : contextFor(decision);

const refusalOver = (request: HookRequest, path: string | null, rulebook: Rulebook): string | null => {
  if (path === null) return null;

  const decision = protectionOf({
    root: rulebook.root,
    path,
    always: [...rulebook.rulebooks, rulebook.baseline],
    protect: rulebook.protect,
    mode: rulebook.mode,
  });

  return decision.verdict === "allow" ? null : answerTo(request, decision);
};

const inIgnoredDirectory = (root: string, path: string, config: ArchitectureConfig): boolean => {
  const skipped = new Set(config.ignoreDirectories ?? IGNORED_DIRECTORIES);
  return relative(root, path)
    .split(sep)
    .slice(0, -1)
    .some((segment) => skipped.has(segment));
};

const analysed = ({ root, config }: Site, roots: readonly string[], path: string | null): boolean =>
  path === null ||
  ((config.extensions ?? SOURCE_EXTENSIONS).includes(extname(path)) &&
    under(roots, path) &&
    !inIgnoredDirectory(root, path, config));

export async function runGuard({ cwd, stdin, write }: RunGuardInput): Promise<number> {
  let payload: unknown;
  try {
    payload = JSON.parse(stdin);
  } catch {
    return 0;
  }

  const found = findConfig(cwd);
  if (found === null) return 0;

  const { config, root, memberConfigs } = await loadConfig(found);
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

  const roots = resolveInclude(root, config.include);
  if (!analysed({ root, config }, roots, target)) return 0;

  const report = withCommand(
    check({
      root,
      roots,
      zones: config.zones,
      boundaries: config.boundaries,
      seams: config.seams,
      maxFilesPerDirectory: config.maxFilesPerDirectory,
      duplication: config.duplication,
      isolate: config.isolate,
      colocation: config.colocation,
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
  const effective =
    recorded.entries.length === 0 ? report : applyBaseline({ report, baseline: recorded, root }).report;

  const decision = decideOnProposal({ report: effective, path: target, root });
  const output = answerTo(request, withReach(decision, target, { root, config }));
  if (output !== null) write(output);
  return 0;
}
