import { relative } from "node:path";
import { baselinePathIn, readBaseline, writeBaseline } from "../adapters/baseline-file.ts";
import { check } from "../compose.ts";
import { findConfig, loadConfig, resolveInclude } from "../config/load.ts";
import { applyBaseline, baselineOf } from "../ratchet/apply.ts";
import { DEFAULT_COMMAND, withCommand } from "../report/invocation.ts";
import { countOf, type Report } from "../report/model.ts";
import { render, renderDots, renderNext, type RatchetSummary } from "./render.ts";

export const EXIT_CLEAN = 0;
export const EXIT_ERRORS = 1;
export const EXIT_STALE_BASELINE = 2;
export const EXIT_NO_CONFIG = 3;

import type { CommandInput } from "./command.ts";

type Present = (report: Report, root: string, ratchet?: RatchetSummary) => string;

const presenterFor = (argv: readonly string[]): Present => {
  if (argv.includes("--json")) return (report) => JSON.stringify(report, null, 2);
  if (argv.includes("--next")) return renderNext;
  return argv.includes("--dots") ? renderDots : render;
};

export async function runCli({ cwd, argv, write }: CommandInput): Promise<number> {
  const present = presenterFor(argv);
  const updating = argv.includes("--update-baseline");
  const explicit = argv.find((entry) => entry.startsWith("--config="))?.slice("--config=".length);
  const path = explicit ?? findConfig(cwd);

  if (path === null || path === undefined) {
    write("no architecture.config.ts found");
    return EXIT_NO_CONFIG;
  }

  const { config, root, memberConfigs } = await loadConfig(path);
  const rulebooks = [path, ...memberConfigs];
  const report = check({
    root,
    roots: resolveInclude(root, config.include),
    zones: config.zones,
    boundaries: config.boundaries,
    seams: config.seams,
    maxFilesPerDirectory: config.maxFilesPerDirectory,
    duplication: config.duplication,
    isolate: config.isolate,
    colocation: config.colocation,
    rules: config.rules,
    runners: config.runners,
    extensions: config.extensions,
    externals: config.externals,
    ignoreDirectories: config.ignoreDirectories,
    ignoreFiles: rulebooks,
  });

  const command = config.command ?? DEFAULT_COMMAND;
  const baselinePath = baselinePathIn(root);

  if (updating) {
    const baseline = baselineOf(report, root);
    writeBaseline(baselinePath, baseline);
    write(`accepted ${baseline.entries.length} findings into ${relative(cwd, baselinePath) || baselinePath}`);
    return EXIT_CLEAN;
  }

  const baseline = readBaseline(baselinePath);
  if (baseline.entries.length === 0) {
    const finished = withCommand(report, command);
    write(present(finished, root));
    return countOf(finished, "error") > 0 ? EXIT_ERRORS : EXIT_CLEAN;
  }

  const ratcheted = applyBaseline({ report, baseline, root });
  const finished = withCommand(ratcheted.report, command);
  write(present(finished, root, { known: ratcheted.known, stale: ratcheted.stale }));

  if (countOf(finished, "error") > 0) return EXIT_ERRORS;
  return ratcheted.stale > 0 ? EXIT_STALE_BASELINE : EXIT_CLEAN;
}
