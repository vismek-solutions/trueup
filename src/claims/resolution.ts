import { relative } from "node:path";
import type { Claim } from "./model.ts";

export const theAnalysisReachedFiles: Claim = {
  name: "the-analysis-reached-files",
  guidance:
    "No file matched the configured roots and extensions, so every other claim passed on nothing. Fix `include` or `extensions` in the config. An empty analysis fails so a mis-scoped config cannot report success.",
  check: ({ graph }) =>
    graph.files.size > 0
      ? []
      : [{ severity: "error", message: "no files were analysed", file: null, start: null }],
};

export const everyImportResolves: Claim = {
  name: "every-import-resolves",
  guidance:
    "A specifier did not resolve, so its edges are absent from the graph and no rule could judge them. Fix the path, the tsconfig paths, or the package exports. This fails rather than warns because a rule that cannot see an edge silently passes it.",
  check: ({ root, graph }) =>
    graph.unresolvedImports.map((entry) => ({
      severity: "error",
      message: `${relative(root, entry.from)} imports ${entry.specifier}, which does not resolve (${entry.reason})`,
      file: entry.from,
      start: entry.start,
    })),
};

export const everyImportedNameIsExported: Claim = {
  name: "every-imported-name-is-exported",
  guidance:
    "The module resolved but exports no such name. Either the import is wrong, or a re-export it used to travel through was removed.",
  check: ({ root, graph }) =>
    graph.edges
      .filter((edge) => edge.to.kind === "missing-export")
      .map((edge) => ({
        severity: "error",
        message: `${relative(root, edge.from)} imports ${edge.imported} from ${edge.specifier}, which does not export it`,
        file: edge.from,
        start: edge.start,
      })),
};

export const everyImportedNameIsUnambiguous: Claim = {
  name: "every-imported-name-is-unambiguous",
  guidance:
    "Two star re-exports supply the same name, so which one a consumer gets is undefined and no rule can say where it came from. Export it from one place, or re-export it by name.",
  check: ({ root, graph }) =>
    graph.edges
      .filter((edge) => edge.to.kind === "ambiguous")
      .map((edge) => ({
        severity: "error",
        message: `${relative(root, edge.from)} imports ${edge.imported} from ${edge.specifier}, which re-exports it from more than one module`,
        file: edge.from,
        start: edge.start,
      })),
};

export const resolutionClaims: readonly Claim[] = [
  theAnalysisReachedFiles,
  everyImportResolves,
  everyImportedNameIsExported,
  everyImportedNameIsUnambiguous,
];
