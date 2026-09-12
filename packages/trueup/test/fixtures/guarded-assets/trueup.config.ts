import { defineRule } from "../../../src/claims/custom.ts";
import { defineConfig } from "../../../src/config/model.ts";

const FORCED = "!important";

export default defineConfig({
  include: ["src"],
  assets: ["**/*.css"],
  zones: [{ name: "src", patterns: ["src/**"] }],
  rules: [
    defineRule(
      "no-stylesheet-forces-a-declaration",
      (project) =>
        project.assets
          .filter((sheet) => project.sourceOf(sheet)?.includes(FORCED) === true)
          .map((sheet) => ({ message: "forces a declaration", file: sheet })),
      "Take the force off and give the element a class of its own.",
    ),
  ],
});
