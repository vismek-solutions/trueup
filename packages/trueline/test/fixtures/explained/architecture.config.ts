import { defineRule } from "../../../src/claims/custom.ts";
import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "engine", patterns: ["src/engine/**"] },
    { name: "domain", patterns: ["src/domain/**"] },
    { name: "shared", patterns: ["src/shared/**"] },
  ],
  boundaries: [{ from: "engine", mayNotReach: ["domain"] }],
  seams: [{ generic: "engine", domain: ["domain"] }],
  rules: [defineRule("a-named-custom-rule", () => [])],
});
