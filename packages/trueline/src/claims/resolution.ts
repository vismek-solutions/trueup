import { relative } from "node:path";
import type { EdgeTarget } from "../graph/model.ts";
import type { Claim } from "./model.ts";

const theAnalysisReachedFiles: Claim = {
  name: "the-analysis-reached-files",
  guidance:
    "No file matched the configured roots and extensions, so every other claim passed on nothing. Fix `include` or `extensions` in the config. An empty analysis fails so a mis-scoped config cannot report success.",
  check: ({ graph }) =>
    graph.files.size > 0
      ? []
      : [{ severity: "error", message: "no files were analysed", file: null, start: null }],
};

const everyImportResolves: Claim = {
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

interface EdgeClaim {
  readonly name: string;
  readonly guidance: string;
  readonly kind: EdgeTarget["kind"];
  readonly fault: string;
}

const edgesEndingIn = ({ name, guidance, kind, fault }: EdgeClaim): Claim => ({
  name,
  guidance,
  check: ({ root, graph }) =>
    graph.edges
      .filter((edge) => edge.to.kind === kind)
      .map((edge) => ({
        severity: "error",
        message: `${relative(root, edge.from)} imports ${edge.imported} from ${edge.specifier}, ${fault}`,
        file: edge.from,
        start: edge.start,
      })),
});

const everyImportedNameIsExported = edgesEndingIn({
  name: "every-imported-name-is-exported",
  kind: "missing-export",
  fault: "which does not export it",
  guidance:
    "The module resolved but exports no such name. Either the import is wrong, or a re-export it used to travel through was removed.",
});

const everyImportedNameIsUnambiguous = edgesEndingIn({
  name: "every-imported-name-is-unambiguous",
  kind: "ambiguous",
  fault: "which re-exports it from more than one module",
  guidance:
    "Two star re-exports supply the same name, so which one a consumer gets is undefined and no rule can say where it came from. Export it from one place, or re-export it by name.",
});

export const resolutionClaims: readonly Claim[] = [
  theAnalysisReachedFiles,
  everyImportResolves,
  everyImportedNameIsExported,
  everyImportedNameIsUnambiguous,
];
