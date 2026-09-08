import { defineRule } from "../../../src/claims/custom.ts";
import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  zones: [
    { name: "engine", patterns: ["src/engine/**", "src/machinery/**"] },
    { name: "domain", patterns: ["src/domain/**"], role: "api" },
    { name: "shared", patterns: ["src/shared/**"] },
    { name: "ui", patterns: ["src/ui/**"] },
  ],
  boundaries: [{ from: "engine", allow: ["shared", "ui"] }],
  seams: [
    { generic: "engine", domain: ["domain", "ui"], allow: ["warrant", "table"], minLiteralLength: 6 },
    { generic: "shared", domain: ["domain"] },
  ],
  isolate: [{ siblings: "src/*", except: ["shared", "ui"] }, { siblings: "src/engine/*" }],
  protect: { paths: ["trueup.config.ts", ".trueup-baseline.json"], decision: "deny" },
  maxFilesPerDirectory: 4,
  duplication: 80,
  colocation: false,
  extensions: [".ts", ".mts"],
  externals: ["virtual:*", "remote:*"],
  ignoreDirectories: ["node_modules", "dist"],
  runners: [
    { name: "a-delegated-tool", run: () => ({ kind: "findings", findings: [] }) },
    { name: "another-delegated-tool", run: () => ({ kind: "findings", findings: [] }) },
  ],
  rules: [defineRule("a-named-custom-rule", () => []), defineRule("another-custom-rule", () => [])],
});
