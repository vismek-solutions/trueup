import { defineRule } from "../../../../../src/claims/custom.ts";
import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  maxFilesPerDirectory: 1,
  zones: [
    { name: "model", patterns: ["src/model/**"] },
    { name: "view", patterns: ["src/view/**"] },
  ],
  seams: [{ generic: "view", domain: ["model"] }],
  rules: [
    defineRule("one-declaration-per-file", (project) =>
      project.files
        .filter((file) => project.declarationsIn(file).length > 1)
        .map((file) => ({ message: `${project.relative(file)} declares more than one thing`, file })),
    ),
    defineRule("sees-only-its-own-package", (project) => [
      { message: `zones ${project.zoneNames.join(",")}`, severity: "warning" as const },
    ]),
  ],
});
