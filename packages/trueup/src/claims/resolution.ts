import type { EdgeTarget } from "../graph/model.ts";
import type { Claim } from "./model.ts";

const theAnalysisReachedFiles: Claim = {
  name: "the-analysis-reached-files",
  check: ({ graph }) => ({
    findings:
      graph.files.size > 0
        ? []
        : [{ severity: "error", message: "no files were analysed", file: null, start: null }],
    guidance: [
      "No file matched the configured roots and extensions, so every other claim passed on nothing.",
      "",
      "Do this:",
      "- Fix `include` or `extensions` in the config.",
      "",
      "An empty analysis fails rather than warns, so a mis-scoped config cannot report success.",
    ].join("\n"),
  }),
};

const everyImportResolves: Claim = {
  name: "every-import-resolves",
  check: ({ graph }) => ({
    findings: graph.unresolvedImports.map((entry) => ({
      severity: "error",
      message: `imports ${entry.specifier}, which does not resolve (${entry.reason})`,
      file: entry.from,
      start: entry.start,
      specifier: entry.specifier,
    })),
    guidance: [
      "A specifier did not resolve, so its edges are absent from the graph and no rule could judge them.",
      "",
      "Do this:",
      "- Fix the path, the tsconfig paths, or the package exports.",
      "",
      "This fails rather than warns, because a rule that cannot see an edge silently passes it.",
    ].join("\n"),
  }),
};

interface EdgeClaim {
  readonly name: string;
  readonly guidance: string;
  readonly kind: EdgeTarget["kind"];
  readonly fault: string;
}

const edgesEndingIn = ({ name, guidance, kind, fault }: EdgeClaim): Claim => ({
  name,
  check: ({ graph }) => ({
    findings: graph.edges
      .filter((edge) => edge.to.kind === kind)
      .map((edge) => ({
        severity: "error",
        message: `imports ${edge.imported} from ${edge.specifier}, ${fault}`,
        file: edge.from,
        start: edge.start,
      })),
    guidance,
  }),
});

const everyImportedNameIsExported = edgesEndingIn({
  name: "every-imported-name-is-exported",
  kind: "missing-export",
  fault: "which does not export it",
  guidance: [
    "The module resolved but exports no such name.",
    "",
    "Do this:",
    "- Correct the import, if the name is wrong.",
    "- Or restore the re-export it used to travel through, if one was removed.",
  ].join("\n"),
});

const everyImportedNameIsUnambiguous = edgesEndingIn({
  name: "every-imported-name-is-unambiguous",
  kind: "ambiguous",
  fault: "which re-exports it from more than one module",
  guidance: [
    "Two star re-exports supply the same name, so which one a consumer gets is undefined and no rule can say where it came from.",
    "",
    "Do this:",
    "- Export it from one place.",
    "- Or re-export it by name rather than through a star.",
  ].join("\n"),
});

export const resolutionClaims: readonly Claim[] = [
  theAnalysisReachedFiles,
  everyImportResolves,
  everyImportedNameIsExported,
  everyImportedNameIsUnambiguous,
];
