import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  zones: [{ name: "src", patterns: ["src/**"] }],
  text: {
    files: ["docs/**/*.md"],
    strings: ["src/**"],
    marks: ["—"],
    words: [{ word: "leverage", instead: "use" }],
    maxParagraphSentences: 2,
  },
});
