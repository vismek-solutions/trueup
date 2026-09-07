import { extname, sep } from "node:path";
import { baselinePathIn, readBaseline } from "../adapters/baseline-file.ts";
import { contextFor, denialFor, requestFrom } from "../adapters/claude-code-hook.ts";
import { SOURCE_EXTENSIONS } from "../adapters/node-files.ts";
import { check } from "../compose.ts";
import { findConfig, loadConfig, resolveInclude } from "../config/load.ts";
import { decideOnProposal } from "../guard/decide.ts";
import type { HookRequest } from "../ports/proposal.ts";
import { applyBaseline } from "../ratchet/apply.ts";
import { DEFAULT_COMMAND, withCommand } from "../report/invocation.ts";

export interface RunGuardInput {
  readonly cwd: string;
  readonly stdin: string;
  readonly write: (line: string) => void;
}

const under = (roots: readonly string[], path: string): boolean =>
  roots.some((root) => path === root || path.startsWith(`${root}${sep}`));

const targetOf = (request: HookRequest): string | null =>
  request.kind === "propose" ? request.proposal.path : request.path;

const overlayOf = (request: HookRequest): Map<string, string> =>
  request.kind === "propose" ? new Map([[request.proposal.path, request.proposal.text]]) : new Map();

export async function runGuard({ cwd, stdin, write }: RunGuardInput): Promise<number> {
  let payload: unknown;
  try {
    payload = JSON.parse(stdin);
  } catch {
    return 0;
  }

  const found = findConfig(cwd);
  if (found === null) return 0;

  const { config, root } = await loadConfig(found);
  const request = requestFrom(payload, root);
  if (request === null) return 0;

  const extensions = config.extensions ?? SOURCE_EXTENSIONS;
  const roots = resolveInclude(root, config.include);
  const target = targetOf(request);
  if (target !== null && (!extensions.includes(extname(target)) || !under(roots, target))) return 0;

  const report = withCommand(
    check({
      root,
      roots,
      zones: config.zones,
      boundaries: config.boundaries,
      seams: config.seams,
      maxFilesPerDirectory: config.maxFilesPerDirectory,
      colocation: config.colocation,
      rules: config.rules,
      extensions: config.extensions,
      ignoreDirectories: config.ignoreDirectories,
      overlay: overlayOf(request),
    }),
    config.command ?? DEFAULT_COMMAND,
  );

  const baseline = readBaseline(baselinePathIn(root));
  const effective = baseline.entries.length === 0 ? report : applyBaseline({ report, baseline, root }).report;

  const decision = decideOnProposal({ report: effective, path: target, root });
  const output = request.kind === "propose" ? denialFor(decision) : contextFor(decision);
  if (output !== null) write(output);
  return 0;
}
