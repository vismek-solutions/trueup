import { defineMember } from "./src/config/model.ts";

const AMBIENT = ["ports", "paths"];

export default defineMember({
  zones: [
    { name: "spec", patterns: ["test/**/*.unit.test.ts"], role: "tests" },
    { name: "flow", patterns: ["test/**"], role: "tests" },
    { name: "ports", patterns: ["src/ports/**"] },
    { name: "paths", patterns: ["src/paths/**"] },
    { name: "graph", patterns: ["src/graph/**"] },
    { name: "zones", patterns: ["src/zones/**"] },
    { name: "lexicon", patterns: ["src/lexicon/**"] },
    { name: "project", patterns: ["src/project/**"] },
    { name: "report", patterns: ["src/report/**"] },
    { name: "ratchet", patterns: ["src/ratchet/**"] },
    { name: "guard", patterns: ["src/guard/**"] },
    { name: "claims", patterns: ["src/claims/**"] },
    { name: "config", patterns: ["src/config/**"] },
    { name: "cli", patterns: ["src/cli/**"], role: "wiring" },
    { name: "adapters", patterns: ["src/adapters/**"] },
    { name: "api", patterns: ["src/index.ts"], role: "api" },
    { name: "bin", patterns: ["bin/**"], role: "wiring" },
    { name: "root", patterns: ["src/compose.ts"], role: "wiring" },
    { name: "tooling", patterns: ["vitest.config.ts"], role: "wiring" },
  ],
  boundaries: [
    { from: "ports", allow: [] },
    { from: "paths", allow: [] },
    { from: "graph", allow: AMBIENT },
    { from: "zones", allow: AMBIENT },
    { from: "lexicon", allow: AMBIENT },
    { from: "adapters", allow: AMBIENT },
    { from: "project", allow: [...AMBIENT, "graph", "zones", "lexicon", "report"] },
    { from: "report", allow: [...AMBIENT, "graph", "zones"] },
    { from: "ratchet", allow: [...AMBIENT, "report"] },
    { from: "guard", allow: [...AMBIENT, "report"] },
    { from: "claims", allow: [...AMBIENT, "graph", "zones", "lexicon", "project", "report"] },
    { from: "config", allow: [...AMBIENT, "claims", "zones", "project"] },
    { from: "cli", allow: [...AMBIENT, "config", "report", "ratchet", "guard", "adapters", "root"] },
  ],
});
