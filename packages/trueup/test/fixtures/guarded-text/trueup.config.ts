import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src", "docs"],
  zones: [{ name: "src", patterns: ["src/**"] }],
  text: {
    files: ["docs/**/*.md"],
    marks: ["—", "--"],
    words: [{ word: "leverage", instead: "use" }],
    maxSentenceWords: 12,
    maxParagraphSentences: 2,
    maxInlineCodeWords: 3,
    links: true,
  },
});
