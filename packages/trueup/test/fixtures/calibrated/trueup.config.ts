import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src", "docs"],
  zones: [{ name: "src", patterns: ["src/**"] }],
  text: {
    files: ["docs/**/*.md"],
    maxSentenceWords: 8,
    maxInlineCodeWords: 3,
  },
});
