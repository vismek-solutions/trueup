import { defineConfig } from "./src/config/model.ts";

const NON_PORTS = ["graph", "zones", "lexicon", "report", "claims", "config", "cli", "adapters", "root"];

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "ports", patterns: ["src/ports/**"] },
    { name: "graph", patterns: ["src/graph/**"] },
    { name: "zones", patterns: ["src/zones/**"] },
    { name: "lexicon", patterns: ["src/lexicon/**"] },
    { name: "report", patterns: ["src/report/**"] },
    { name: "claims", patterns: ["src/claims/**"] },
    { name: "config", patterns: ["src/config/**"] },
    { name: "cli", patterns: ["src/cli/**"] },
    { name: "adapters", patterns: ["src/adapters/**"] },
    { name: "root", patterns: ["src/compose.ts"] },
  ],
  rules: [
    { from: "ports", mayNotReach: NON_PORTS },
    { from: "graph", mayNotReach: ["adapters", "zones", "lexicon", "report", "claims", "config", "cli", "root"] },
    { from: "zones", mayNotReach: ["adapters", "graph", "lexicon", "report", "claims", "config", "cli", "root"] },
    { from: "lexicon", mayNotReach: ["adapters", "graph", "zones", "report", "claims", "config", "cli", "root"] },
    { from: "report", mayNotReach: ["adapters", "claims", "config", "cli", "root"] },
    { from: "claims", mayNotReach: ["adapters", "config", "cli", "root"] },
    { from: "config", mayNotReach: ["adapters", "graph", "lexicon", "cli", "root"] },
    { from: "adapters", mayNotReach: ["graph", "zones", "lexicon", "report", "claims", "config", "cli", "root"] },
    { from: "cli", mayNotReach: ["adapters", "graph", "zones", "lexicon", "claims"] },
  ],
});
