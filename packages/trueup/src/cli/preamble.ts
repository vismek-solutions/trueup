import { inspect, type Overlay } from "../compose.ts";
import { resolveInclude, type LoadedConfig } from "../config/load.ts";
import { DEFAULT_COMMAND } from "../report/invocation.ts";

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

export const projectFor = (
  { config, path, root, memberConfigs }: LoadedConfig,
  overlay?: Overlay,
): ReturnType<typeof inspect> =>
  inspect({
    root,
    roots: resolveInclude(root, config.include),
    zones: config.zones,
    extensions: config.extensions,
    externals: config.externals,
    ignoreDirectories: config.ignoreDirectories,
    ignoreFiles: [path, ...memberConfigs],
    overlay,
  });
