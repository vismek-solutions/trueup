import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "engine", patterns: ["src/engine/**"] },
    { name: "domain", patterns: ["src/domain/**"] },
  ],
  boundaries: [{ from: "engine", allow: [] }],
  reviewable: { additions: 10, deletions: 10 },
  changes: {
    since: (_root, base) => ({
      kind: "measured",
      base,
      files: [{ file: "src/engine/runner.ts", added: 44, removed: 2 }],
    }),
  },
});
