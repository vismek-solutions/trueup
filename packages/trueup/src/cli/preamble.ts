import { inspect, type Overlay } from "../compose.ts";
import { findConfig, loadConfig, messageOf, resolveInclude, type LoadedConfig } from "../config/load.ts";
import type { ResolvedConfig } from "../config/model.ts";
import { DEFAULT_COMMAND } from "../report/invocation.ts";
import { EXIT_BAD_RULEBOOK, EXIT_NO_CONFIG } from "./command.ts";

export const refusedArguments = (
  argv: readonly string[],
  usage: string,
  write: (line: string) => void,
): boolean => {
  if (argv.length === 0) return false;

  write(`unrecognised: ${argv.join(" ")}`);
  write(`usage: ${DEFAULT_COMMAND} ${usage}`);
  return true;
};

export const rulebookAt = async (
  path: string,
  write: (line: string) => void,
): Promise<LoadedConfig | null> => {
  try {
    return await loadConfig(path);
  } catch (failure) {
    write("the rulebook was found but could not be read, so nothing was checked");
    for (const line of messageOf(failure).split("\n")) write(`  ${line}`);
    write("  Until it loads, every rule it declares is off, and no run will say so.");
    return null;
  }
};

export const rulebookIn = async (
  cwd: string,
  write: (line: string) => void,
): Promise<LoadedConfig | number> => {
  const path = findConfig(cwd);
  if (path === null) {
    write("no trueup.config.ts found");
    return EXIT_NO_CONFIG;
  }

  return (await rulebookAt(path, write)) ?? EXIT_BAD_RULEBOOK;
};

const projectFor = (
  { config, root }: LoadedConfig,
  rulebooks: readonly string[],
  overlay?: Overlay,
) =>
  inspect({
    root,
    roots: resolveInclude(root, config.include),
    zones: config.zones,
    extensions: config.extensions,
    externals: config.externals,
    ignoreDirectories: config.ignoreDirectories,
    ignoreFiles: rulebooks,
    overlay,
  });

export interface Opened {
  readonly config: ResolvedConfig;
  readonly root: string;
  readonly project: ReturnType<typeof inspect>;
  readonly rulebooks: readonly string[];
}

export const openedIn = async (
  cwd: string,
  write: (line: string) => void,
  overlay?: Overlay,
): Promise<Opened | number> => {
  const loaded = await rulebookIn(cwd, write);
  if (typeof loaded === "number") return loaded;

  const rulebooks = [loaded.path, ...loaded.memberConfigs];
  return {
    config: loaded.config,
    root: loaded.root,
    project: projectFor(loaded, rulebooks, overlay),
    rulebooks,
  };
};
