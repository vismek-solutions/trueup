import { relative } from "node:path";
import type { Claim } from "./model.ts";

export const theAnalysisReachedFiles: Claim = {
  name: "the-analysis-reached-files",
  check: ({ graph }) =>
    graph.files.size > 0
      ? []
      : [{ severity: "error", message: "no files were analysed", file: null, start: null }],
};

export const everyImportResolves: Claim = {
  name: "every-import-resolves",
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
