import { join } from "node:path";
import { defineRule } from "../../../../../src/claims/custom.ts";
import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  allow: ["core"],
  maxFilesPerDirectory: 1,
  zones: [
    { name: "model", patterns: ["src/model/**"] },
    { name: "view", patterns: ["src/view/**"] },
  ],
  seams: [{ generic: "view", domain: ["model"] }],
  boundaries: [{ from: "view", allow: [] }],
  rules: [
    defineRule("one-declaration-per-file", (project) =>
      project.files
        .filter((file) => project.declarationsIn(file).length > 1)
        .map((file) => ({ message: `${project.relative(file)} declares more than one thing`, file })),
    ),
    defineRule("sees-only-its-own-package", (project) => [
      { message: `zones ${project.zoneNames.join(",")}`, severity: "warning" as const },
    ]),
    defineRule("reports-what-the-scope-lets-it-see", (project) => {
      const named = (files: readonly string[]): string =>
        [...files].map((file) => project.relative(file)).sort().join(" ");
      const outside = join(project.root, "packages/core/src/index.ts");
      const crossings = project
        .imports()
        .map((edge) => `${edge.fromZone}>${edge.declaredZone}`)
        .sort();

      return [
        `filesIn view: ${named(project.filesIn("view"))}`,
        `zoneOf inside: ${project.zoneOf(project.filesIn("model")[0] ?? "")}`,
        `zoneOf outside: ${project.zoneOf(outside)}`,
        `imports: ${[...new Set(crossings)].join(" ")}`,
        `imports from view: ${named(project.imports({ fromZone: "view" }).map((edge) => edge.from))}`,
        `imports into model: ${named(project.imports({ declaredZone: "model" }).map((edge) => edge.from))}`,
        `names in model: ${[...project.vocabularyOf(["model"]).names].sort().join(" ")}`,
      ].map((message) => ({ message, severity: "warning" as const }));
    }),
  ],
});
