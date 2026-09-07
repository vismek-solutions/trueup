import { check } from "../compose.ts";
import { findConfig, loadConfig, resolveInclude } from "../config/load.ts";
import { countOf } from "../report/model.ts";
import { render } from "./render.ts";

export interface RunCliInput {
  readonly cwd: string;
  readonly argv: readonly string[];
  readonly write: (line: string) => void;
}

export async function runCli({ cwd, argv, write }: RunCliInput): Promise<number> {
  const asJson = argv.includes("--json");
  const explicit = argv.find((entry) => entry.startsWith("--config="))?.slice("--config=".length);
  const path = explicit ?? findConfig(cwd);

  if (path === null || path === undefined) {
    write("no architecture.config.ts found");
    return 2;
  }

  const { config, root } = await loadConfig(path);
  const report = check({
    root,
    roots: resolveInclude(root, config.include),
    zones: config.zones,
    rules: config.rules,
    extensions: config.extensions,
    ignoreDirectories: config.ignoreDirectories,
  });

  write(asJson ? JSON.stringify(report, null, 2) : render(report, root));
  return countOf(report, "error") > 0 ? 1 : 0;
}
