import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  zones: [{ name: "app", patterns: ["src/**"] }],
  reviewable: { additions: 90, deletions: 40, base: "trunk" },
});
