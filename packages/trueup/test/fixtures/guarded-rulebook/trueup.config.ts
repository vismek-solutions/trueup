import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  protect: { decision: "allow" },
  zones: [{ name: "src", patterns: ["src/**"] }],
});
