import { extname, sep } from "node:path";
import { baselinePathIn, readBaseline } from "../adapters/baseline-file.ts";
import { denialFor, proposalFrom } from "../adapters/claude-code-hook.ts";
import { SOURCE_EXTENSIONS } from "../adapters/node-files.ts";
import { check } from "../compose.ts";
import { findConfig, loadConfig, resolveInclude } from "../config/load.ts";
import { decideOnProposal } from "../guard/decide.ts";
import { applyBaseline } from "../ratchet/apply.ts";
import { DEFAULT_COMMAND, withCommand } from "../report/invocation.ts";

export interface RunGuardInput {
  readonly cwd: string;
  readonly stdin: string;
  readonly write: (line: string) => void;
}

const under = (roots: readonly string[], path: string): boolean =>
  roots.some((root) => path === root || path.startsWith(`${root}${sep}`));

export async function runGuard({ cwd, stdin, write }: RunGuardInput): Promise<number> {
  let payload: unknown;
  try {
    payload = JSON.parse(stdin);
  } catch {
    return 0;
  }

  const proposal = proposalFrom(payload);
  if (proposal === null) return 0;

  const path = findConfig(cwd);
  if (path === null) return 0;

  const { config, root } = await loadConfig(path);
  const extensions = config.extensions ?? SOURCE_EXTENSIONS;
  if (!extensions.includes(extname(proposal.path))) return 0;

  const roots = resolveInclude(root, config.include);
  if (!under(roots, proposal.path)) return 0;

  const report = withCommand(
    check({
      root,
      roots,
      zones: config.zones,
      boundaries: config.boundaries,
      seams: config.seams,
      maxFilesPerDirectory: config.maxFilesPerDirectory,
      rules: config.rules,
      extensions: config.extensions,
      ignoreDirectories: config.ignoreDirectories,
      overlay: new Map([[proposal.path, proposal.text]]),
    }),
    config.command ?? DEFAULT_COMMAND,
  );

  const baseline = readBaseline(baselinePathIn(root));
  const effective = baseline.entries.length === 0 ? report : applyBaseline({ report, baseline, root }).report;

  const denial = denialFor(decideOnProposal({ report: effective, path: proposal.path }));
  if (denial !== null) write(denial);
  return 0;
}
