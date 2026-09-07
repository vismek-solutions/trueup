import { relative } from "node:path";
import { baselinePathIn, readBaseline, writeBaseline } from "../adapters/baseline-file.ts";
import { check } from "../compose.ts";
import { findConfig, loadConfig, resolveInclude } from "../config/load.ts";
import { applyBaseline, baselineOf } from "../ratchet/apply.ts";
import { DEFAULT_COMMAND, withCommand } from "../report/invocation.ts";
import { countOf } from "../report/model.ts";
import { render } from "./render.ts";

export const EXIT_CLEAN = 0;
export const EXIT_ERRORS = 1;
export const EXIT_STALE_BASELINE = 2;
export const EXIT_NO_CONFIG = 3;

export interface RunCliInput {
  readonly cwd: string;
  readonly argv: readonly string[];
  readonly write: (line: string) => void;
}

export async function runCli({ cwd, argv, write }: RunCliInput): Promise<number> {
  const asJson = argv.includes("--json");
  const updating = argv.includes("--update-baseline");
  const explicit = argv.find((entry) => entry.startsWith("--config="))?.slice("--config=".length);
  const path = explicit ?? findConfig(cwd);

  if (path === null || path === undefined) {
    write("no architecture.config.ts found");
    return EXIT_NO_CONFIG;
  }

  const { config, root } = await loadConfig(path);
  const report = check({
    root,
    roots: resolveInclude(root, config.include),
    zones: config.zones,
    boundaries: config.boundaries,
    seams: config.seams,
    maxFilesPerDirectory: config.maxFilesPerDirectory,
    colocation: config.colocation,
    rules: config.rules,
    runners: config.runners,
    extensions: config.extensions,
    ignoreDirectories: config.ignoreDirectories,
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
    write(asJson ? JSON.stringify(finished, null, 2) : render(finished, root));
    return countOf(finished, "error") > 0 ? EXIT_ERRORS : EXIT_CLEAN;
  }

  const ratcheted = applyBaseline({ report, baseline, root });
  const finished = withCommand(ratcheted.report, command);
  write(
    asJson
      ? JSON.stringify(finished, null, 2)
      : render(finished, root, { known: ratcheted.known, stale: ratcheted.stale }),
  );

  if (countOf(finished, "error") > 0) return EXIT_ERRORS;
  return ratcheted.stale > 0 ? EXIT_STALE_BASELINE : EXIT_CLEAN;
}
