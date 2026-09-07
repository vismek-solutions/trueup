import { parseModule } from "./adapters/oxc-parse.js";
import { createResolver } from "./adapters/oxc-resolve.js";
import { discoverFiles, readSource, type DiscoverFilesOptions } from "./adapters/node-files.js";
import { buildSymbolGraph } from "./graph/build.js";
import type { SymbolGraph } from "./graph/model.js";

export function analyze(options: DiscoverFilesOptions): SymbolGraph {
  const files = discoverFiles(options);
  const modules = files.map((path) => parseModule(path, readSource(path)));
  return buildSymbolGraph({ modules, resolve: createResolver() });
}
