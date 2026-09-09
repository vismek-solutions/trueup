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
  colocation: true,
  readerships: true,
  testInternals: true,
});
