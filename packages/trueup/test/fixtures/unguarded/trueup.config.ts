import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src", "lib"],
  protect: { decision: "allow" },
  zones: [{ name: "all", patterns: ["src/**", "lib/**"] }],
});
