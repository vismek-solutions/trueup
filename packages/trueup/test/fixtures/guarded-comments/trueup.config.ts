import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  zones: [{ name: "src", patterns: ["src/**"] }],
  text: {
    files: ["docs/**/*.md"],
    comments: true,
    marks: ["—", "--"],
    words: [{ word: "leverage", instead: "use" }],
    maxSentenceWords: 12,
  },
});
