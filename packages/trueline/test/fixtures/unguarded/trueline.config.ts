import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  protect: { decision: "allow" },
  zones: [{ name: "all", patterns: ["src/**"] }],
});
