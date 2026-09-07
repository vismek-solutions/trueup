import { defineRule } from "./src/claims/custom.ts";
import { defineConfig } from "./src/config/model.ts";

const LAYERS = [
  "graph",
  "zones",
  "lexicon",
  "project",
  "report",
  "ratchet",
  "claims",
  "config",
  "cli",
  "adapters",
  "root",
];
const allBut = (...kept: string[]): string[] => LAYERS.filter((layer) => !kept.includes(layer));

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "ports", patterns: ["src/ports/**"] },
    { name: "graph", patterns: ["src/graph/**"] },
    { name: "zones", patterns: ["src/zones/**"] },
    { name: "lexicon", patterns: ["src/lexicon/**"] },
    { name: "project", patterns: ["src/project/**"] },
    { name: "report", patterns: ["src/report/**"] },
    { name: "ratchet", patterns: ["src/ratchet/**"] },
    { name: "claims", patterns: ["src/claims/**"] },
    { name: "config", patterns: ["src/config/**"] },
    { name: "cli", patterns: ["src/cli/**"] },
    { name: "adapters", patterns: ["src/adapters/**"] },
    { name: "root", patterns: ["src/compose.ts", "src/index.ts"] },
  ],
  boundaries: [
    { from: "ports", mayNotReach: LAYERS },
    { from: "graph", mayNotReach: allBut("graph") },
    { from: "zones", mayNotReach: allBut("zones") },
    { from: "lexicon", mayNotReach: allBut("lexicon") },
    { from: "adapters", mayNotReach: allBut("adapters") },
    { from: "project", mayNotReach: allBut("project", "graph", "zones", "lexicon", "report") },
    { from: "report", mayNotReach: allBut("report", "graph", "zones") },
    { from: "ratchet", mayNotReach: allBut("ratchet", "report") },
    { from: "claims", mayNotReach: allBut("claims", "graph", "zones", "lexicon", "project", "report") },
    { from: "config", mayNotReach: allBut("config", "claims", "zones", "project") },
    { from: "cli", mayNotReach: allBut("cli", "config", "report", "ratchet", "adapters", "root") },
  ],
  rules: [
    defineRule("no-two-zones-import-each-other", (project) => {
      const reaches = new Map<string, Set<string>>();
      for (const entry of project.imports()) {
        if (entry.fromZone === null || entry.declaredZone === null) continue;
        if (entry.fromZone === entry.declaredZone) continue;
        const targets = reaches.get(entry.fromZone) ?? new Set<string>();
        targets.add(entry.declaredZone);
        reaches.set(entry.fromZone, targets);
      }

      return [...reaches].flatMap(([zone, targets]) =>
        [...targets]
          .filter((target) => zone < target && reaches.get(target)?.has(zone) === true)
          .map((target) => ({ message: `zones ${zone} and ${target} import each other` })),
      );
    }),
  ],
});
