import { readSets, readSources, type DiscoverFilesOptions } from "../adapters/node-files.ts";
import { parseModule, readDeclarations, readMentions } from "../adapters/oxc-parse.ts";
import { createResolver } from "../adapters/oxc-resolve.ts";
import { buildSymbolGraph } from "../graph/build.ts";
import type { SymbolGraph } from "../graph/model.ts";
import { buildLexicon } from "../lexicon/build.ts";
import type { ModuleRecord, ParseModule } from "../ports/module-record.ts";
import { buildProject } from "../project/build.ts";
import type { Project } from "../project/model.ts";
import { assignZones } from "../zones/assign.ts";
import type { ZoneDefinition } from "../zones/model.ts";

export type Overlay = ReadonlyMap<string, string>;

const parseAll = (sources: ReadonlyMap<string, string>, parse: ParseModule): ModuleRecord[] =>
  [...sources].map(([path, text]) => parse(path, text));

export interface AnalyzeOptions extends DiscoverFilesOptions {
  readonly externals?: readonly string[] | undefined;
}

export function analyze(options: AnalyzeOptions): SymbolGraph {
  return buildSymbolGraph({
    modules: parseAll(readSources(options), parseModule),
    resolve: createResolver({ externals: options.externals }),
  });
}

export interface InspectOptions {
  readonly root: string;
  readonly roots?: readonly string[] | undefined;
  readonly zones: readonly ZoneDefinition[];
  readonly extensions?: readonly string[] | undefined;
  readonly externals?: readonly string[] | undefined;
  readonly ignoreDirectories?: readonly string[] | undefined;
  readonly ignoreFiles?: readonly string[] | undefined;
  readonly assets?: readonly string[] | undefined;
  readonly overlay?: Overlay | undefined;
}

export const analyseProject = (options: InspectOptions) => {
  const { root, roots, zones, extensions, externals, ignoreDirectories, ignoreFiles, overlay } = options;
  const roughly = { roots: roots ?? [root], extensions, ignoreDirectories, ignoreFiles };
  // an asset is never parsed, never in the graph and never zoned, so a stylesheet owes no zone
  const { sources, assets } = readSets({ root, ...roughly, assets: options.assets }, overlay);
  const modules = parseAll(sources, parseModule);
  const graph = buildSymbolGraph({ modules, resolve: createResolver({ externals }) });
  const assignment = assignZones({ root, files: [...graph.files], zones });
  const lexicon = buildLexicon({ modules, sources, readMentions, readDeclarations });

  return {
    graph,
    zones: assignment,
    lexicon,
    project: buildProject({ root, graph, zones: assignment, lexicon, sources, assets }),
  };
};

export const inspect = (options: InspectOptions): Project => analyseProject(options).project;
