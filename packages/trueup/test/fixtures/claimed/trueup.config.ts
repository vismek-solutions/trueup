import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  zones: [
    { name: "app", patterns: ["app/**"] },
    { name: "lib", patterns: ["lib/**"] },
    { name: "spec", patterns: ["spec/**"], role: "tests" },
  ],
  boundaries: [{ from: "app", allow: [] }],
  duplication: 40,
  colocation: true,
});
