import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  zones: [
    { name: "app", patterns: ["app/**"] },
    { name: "lib", patterns: ["lib/**"] },
  ],
  boundaries: [{ from: "app", allow: [] }],
  duplication: 40,
});
