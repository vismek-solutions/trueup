import { defineConfig } from "./src/config/model.ts";

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "ports", patterns: ["src/ports/**"] },
    { name: "graph", patterns: ["src/graph/**"] },
    { name: "zones", patterns: ["src/zones/**"] },
    { name: "report", patterns: ["src/report/**"] },
    { name: "claims", patterns: ["src/claims/**"] },
    { name: "config", patterns: ["src/config/**"] },
    { name: "cli", patterns: ["src/cli/**"] },
    { name: "adapters", patterns: ["src/adapters/**"] },
    { name: "root", patterns: ["src/compose.ts"] },
  ],
  rules: [
    { from: "ports", mayNotReach: ["graph", "zones", "report", "claims", "config", "cli", "adapters", "root"] },
    { from: "graph", mayNotReach: ["adapters", "zones", "report", "claims", "config", "cli", "root"] },
    { from: "zones", mayNotReach: ["graph", "adapters", "report", "claims", "config", "cli", "root"] },
    { from: "report", mayNotReach: ["adapters", "claims", "config", "cli", "root"] },
    { from: "claims", mayNotReach: ["adapters", "config", "cli", "root"] },
    { from: "config", mayNotReach: ["adapters", "graph", "cli", "root"] },
    { from: "adapters", mayNotReach: ["graph", "zones", "report", "claims", "config", "cli", "root"] },
    { from: "cli", mayNotReach: ["adapters", "graph", "zones", "claims"] },
  ],
});
