import { relative } from "node:path";
import { baselinePathIn, readBaseline, writeBaseline } from "../adapters/baseline-file.ts";
import { check } from "../compose.ts";
import { findConfig, resolveInclude } from "../config/load.ts";
import { rulebookGuarded } from "../guard/protected.ts";
import { acceptanceOf, applyBaseline, baselineOf } from "../ratchet/apply.ts";
import { DEFAULT_COMMAND, withCommand } from "../report/invocation.ts";
import { type ClaimResult, countOf, type Report } from "../report/model.ts";
import { renderAcceptance } from "./acceptance.ts";
import { renderGitlab } from "./gitlab.ts";
import { helpLines } from "./help.ts";
import { rulebookAt } from "./preamble.ts";
import { answering, render, renderDots, renderNext, type RatchetSummary } from "./render.ts";

const REPORT_FLAGS = ["--json", "--gitlab", "--next", "--dots", "--update-baseline", "--help", "-h"];

const VALUED_FLAGS = ["--config=", "--next="];

const unknownArgumentsIn = (argv: readonly string[], known: readonly string[]): readonly string[] =>
  argv.filter((entry) => !known.includes(entry) && !VALUED_FLAGS.some((flag) => entry.startsWith(flag)));

const REPORTS = ["--dots", "--next", "--json", "--gitlab", "--update-baseline"];

const reportsIn = (argv: readonly string[]): readonly string[] =>
  REPORTS.filter((flag) => argv.some((entry) => entry === flag || entry.startsWith(`${flag}=`)));

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

type Reported = Omit<ClaimResult, "guidance"> & { readonly guidance?: string };

const reported = ({ guidance, ...rest }: ClaimResult): Reported =>
  rest.findings.length === 0 ? rest : { ...rest, guidance };

const asJson = (report: Report): string =>
  JSON.stringify({ ...report, claims: report.claims.map(reported) }, null, 2);

const named = (report: Report, only: string | undefined): boolean =>
  only === undefined || answering(report.claims, only).length > 0;

const exitFor = (report: Report, only: string | undefined, stale: number): number => {
  if (countOf(report, "error") > 0) return EXIT_ERRORS;
  if (stale > 0) return EXIT_STALE_BASELINE;
  return named(report, only) ? EXIT_CLEAN : EXIT_BAD_USAGE;
};

interface Asked {
  readonly argv: readonly string[];
  readonly rulebook: string;
  readonly command: string;
  readonly only: string | undefined;
}

const presenterFor = ({ argv, rulebook, command, only }: Asked): Present => {
  if (argv.includes("--json")) return asJson;
  if (argv.includes("--gitlab")) return (report, root) => renderGitlab(report, root, rulebook);

  if (argv.includes("--next") || argv.some((entry) => entry.startsWith("--next="))) {
    return (report, root, ratchet) => renderNext(report, root, { ratchet, only, command });
  }
  return argv.includes("--dots") ? renderDots : render;
};

const refusalIn = (argv: readonly string[]): string | null => {
  const unknown = unknownArgumentsIn(argv, REPORT_FLAGS);
  if (unknown.length > 0) return `unrecognised: ${unknown.join(" ")}`;

  const reports = reportsIn(argv);
  if (reports.length < 2) return null;

  return `${reports.join(" and ")} answer different questions, so give one of them`;
};

const usageIn = (argv: readonly string[], write: (line: string) => void): number | null => {
  const refused = refusalIn(argv);
  const asked = argv.includes("--help") || argv.includes("-h");
  if (!asked && refused === null) return null;

  if (!asked && refused !== null) {
    write(refused);
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

  if (path === null) {
    write("no trueup.config.ts found");
    return EXIT_NO_CONFIG;
  }

  const loaded = await rulebookAt(path, write);
  if (loaded === null) return EXIT_BAD_RULEBOOK;

  const { config, root, memberConfigs } = loaded;
  const command = config.command ?? DEFAULT_COMMAND;
  const only = claimFilterIn(argv);
  const present = presenterFor({ argv, rulebook: path, command, only });
  const rulebooks = [path, ...memberConfigs];
  const report = await check({
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
    reviewable: config.reviewable,
    changes: config.changes,
    isolate: config.isolate,
    colocation: config.colocation,
    readerships: config.readerships,
    testInternals: config.testInternals,
    rules: config.rules,
    runners: config.runners,
    extensions: config.extensions,
    externals: config.externals,
    ignoreDirectories: config.ignoreDirectories,
    assets: config.assets,
    ignoreFiles: rulebooks,
  });

  const baselinePath = baselinePathIn(root);
  const previous = readBaseline(baselinePath);
  const noticed = rulebookGuarded(config.protect)
    ? report
    : { ...report, notices: ["the rulebook is unguarded: an agent may edit this config and the baseline"] };

  if (updating) {
    const baseline = baselineOf(report, root);
    writeBaseline(baselinePath, baseline);
    write(
      renderAcceptance({
        ...acceptanceOf({ next: baseline, previous, report }),
        total: baseline.entries.length,
        path: relative(cwd, baselinePath) || baselinePath,
      }),
    );
    return EXIT_CLEAN;
  }

  if (previous.entries.length === 0) {
    const finished = withCommand(noticed, command);
    write(present(finished, root));
    return exitFor(finished, only, 0);
  }

  const ratcheted = applyBaseline({ report: noticed, baseline: previous, root });
  const finished = withCommand(ratcheted.report, command);
  write(present(finished, root, { known: ratcheted.known, stale: ratcheted.stale }));

  return exitFor(finished, only, ratcheted.stale);
}
