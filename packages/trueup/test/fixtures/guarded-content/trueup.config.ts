import { defineRule } from "../../../src/claims/custom.ts";
import { defineConfig } from "../../../src/config/model.ts";

const STRAY = "stray-class";

export default defineConfig({
  include: ["src"],
  zones: [{ name: "src", patterns: ["src/**"] }],
  rules: [
    defineRule(
      "no-file-wears-a-stray-class",
      (project) =>
        project.files
          .filter((file) => project.sourceOf(file)?.includes(STRAY) === true)
          .map((file) => ({ message: "wears the stray class", file })),
      "Remove the stray class.",
    ),
  ],
});
