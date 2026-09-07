import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "engine", patterns: ["src/engine/**"] },
    { name: "domain", patterns: ["src/domain/**"] },
  ],
  boundaries: [{ from: "engine", mayNotReach: ["domain"] }],
});
