import { relative } from "node:path";
import { baselinePathIn, readBaseline, writeBaseline } from "../adapters/baseline-file.ts";
import { check } from "../compose.ts";
import { findConfig, resolveInclude } from "../config/load.ts";
import { rulebookGuarded } from "../guard/protected.ts";
import { applyBaseline, baselineOf } from "../ratchet/apply.ts";
import { DEFAULT_COMMAND, withCommand } from "../report/invocation.ts";
import { countOf, type Report } from "../report/model.ts";
import { renderGitlab } from "./gitlab.ts";
import { helpLines } from "./help.ts";
import { rulebookAt } from "./preamble.ts";
import { render, renderDots, renderNext, type RatchetSummary } from "./render.ts";

const REPORT_FLAGS = ["--json", "--gitlab", "--next", "--dots", "--update-baseline", "--help", "-h"];

const VALUED_FLAGS = ["--config=", "--next="];

const unknownArgumentsIn = (argv: readonly string[], known: readonly string[]): readonly string[] =>
  argv.filter((entry) => !known.includes(entry) && !VALUED_FLAGS.some((flag) => entry.startsWith(flag)));

import {
  EXIT_BAD_RULEBOOK,
  EXIT_BAD_USAGE,
  EXIT_CLEAN,
  EXIT_ERRORS,
  EXIT_NO_CONFIG,
  EXIT_STALE_BASELINE,
  type CommandInput,
} from "./command.ts";

type Present = (report: Report, root: string, ratchet?: RatchetSummary) => string;

const claimFilterIn = (argv: readonly string[]): string | undefined => {
  const named = argv.find((entry) => entry.startsWith("--next="))?.slice("--next=".length);
  return named === "" ? undefined : named;
};

const presenterFor = (argv: readonly string[], rulebook: string): Present => {
  if (argv.includes("--json")) return (report) => JSON.stringify(report, null, 2);
  if (argv.includes("--gitlab")) return (report, root) => renderGitlab(report, root, rulebook);

  const only = claimFilterIn(argv);
  if (argv.includes("--next") || argv.some((entry) => entry.startsWith("--next="))) {
    return (report, root, ratchet) => renderNext(report, root, { ratchet, only });
  }
  return argv.includes("--dots") ? renderDots : render;
};

const usageIn = (argv: readonly string[], write: (line: string) => void): number | null => {
  const unknown = unknownArgumentsIn(argv, REPORT_FLAGS);
  const asked = argv.includes("--help") || argv.includes("-h");
  if (!asked && unknown.length === 0) return null;

  if (!asked) {
    write(`unrecognised: ${unknown.join(" ")}`);
    write("");
  }
  for (const line of helpLines()) write(line);

  return asked ? EXIT_CLEAN : EXIT_BAD_USAGE;
};

export async function runCli({ cwd, argv, write }: CommandInput): Promise<number> {
  const usage = usageIn(argv, write);
  if (usage !== null) return usage;

  const updating = argv.includes("--update-baseline");
  const explicit = argv.find((entry) => entry.startsWith("--config="))?.slice("--config=".length);
  const path = explicit ?? findConfig(cwd);

  if (path === null || path === undefined) {
    write("no trueup.config.ts found");
    return EXIT_NO_CONFIG;
  }

  const present = presenterFor(argv, path);
  const loaded = await rulebookAt(path, write);
  if (loaded === null) return EXIT_BAD_RULEBOOK;

  const { config, root, memberConfigs } = loaded;
  const rulebooks = [path, ...memberConfigs];
  const report = check({
    root,
    roots: resolveInclude(root, config.include),
    zones: config.zones,
    boundaries: config.boundaries,
    seams: config.seams,
    maxFilesPerDirectory: config.maxFilesPerDirectory,
    directoryLimits: config.directoryLimits,
    apiSurfaces: config.apiSurfaces,
    grants: config.grants,
    duplication: config.duplication,
    isolate: config.isolate,
    colocation: config.colocation,
    testInternals: config.testInternals,
    rules: config.rules,
    runners: config.runners,
    extensions: config.extensions,
    externals: config.externals,
    ignoreDirectories: config.ignoreDirectories,
    ignoreFiles: rulebooks,
  });

  const command = config.command ?? DEFAULT_COMMAND;
  const baselinePath = baselinePathIn(root);
  const noticed = rulebookGuarded(config.protect)
    ? report
    : { ...report, notices: ["the rulebook is unguarded: an agent may edit this config and the baseline"] };

  if (updating) {
    const baseline = baselineOf(report, root);
    writeBaseline(baselinePath, baseline);
    write(`accepted ${baseline.entries.length} findings into ${relative(cwd, baselinePath) || baselinePath}`);
    return EXIT_CLEAN;
  }

  const baseline = readBaseline(baselinePath);
  if (baseline.entries.length === 0) {
    const finished = withCommand(noticed, command);
    write(present(finished, root));
    return countOf(finished, "error") > 0 ? EXIT_ERRORS : EXIT_CLEAN;
  }

  const ratcheted = applyBaseline({ report: noticed, baseline, root });
  const finished = withCommand(ratcheted.report, command);
  write(present(finished, root, { known: ratcheted.known, stale: ratcheted.stale }));

  if (countOf(finished, "error") > 0) return EXIT_ERRORS;
  return ratcheted.stale > 0 ? EXIT_STALE_BASELINE : EXIT_CLEAN;
}
