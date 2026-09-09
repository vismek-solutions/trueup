import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  zones: [
    { name: "app", patterns: ["src/app/**"] },
    { name: "lib", patterns: ["src/lib/**"] },
  ],
  isolate: [
    { siblings: "src/*", wiring: [] },
    { siblings: "src/app/*", wiring: ["src/app/index.ts", "src/app/main.ts"] },
  ],
  reviewable: { additions: 600, deletions: 400, nearing: 0.8, severity: "error" },
  colocation: true,
  readerships: true,
  testInternals: true,
});
