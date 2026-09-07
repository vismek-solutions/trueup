import { biomeRunner } from "./src/adapters/biome-runner.ts";
import { fallowRunner } from "./src/adapters/fallow-runner.ts";
import { IGNORED_DIRECTORIES } from "./src/adapters/node-files.ts";
import { oxlintRunner } from "./src/adapters/oxlint-runner.ts";
import { defineConfig } from "./src/config/model.ts";

const LAYERS = [
  "spec",
  "api",
  "bin",
  "graph",
  "zones",
  "lexicon",
  "project",
  "report",
  "ratchet",
  "guard",
  "claims",
  "config",
  "cli",
  "adapters",
  "root",
];
const allBut = (...kept: string[]): string[] => LAYERS.filter((layer) => !kept.includes(layer));

export default defineConfig({
  include: ["src", "test", "bin"],
  ignoreDirectories: [...IGNORED_DIRECTORIES, "fixtures"],
  command: "node ./bin/trueline.js",
  maxFilesPerDirectory: 12,
  duplication: 60,
  colocation: true,
  runners: [
    biomeRunner({
      command: ["node_modules/.bin/biome", "lint"],
      paths: ["src", "test", "bin"],
      write: process.env.CI === undefined,
    }),
    fallowRunner({ command: ["node_modules/.bin/fallow"] }),
    oxlintRunner({
      command: ["node_modules/.bin/oxlint"],
      paths: ["src", "test", "bin"],
      categories: ["eslint/max-params"],
    }),
  ],
  zones: [
    { name: "spec", patterns: ["test/**"], role: "tests" },
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
  ],
  boundaries: [
    { from: "ports", mayNotReach: LAYERS },
    { from: "paths", mayNotReach: LAYERS },
    { from: "graph", mayNotReach: allBut("graph") },
    { from: "zones", mayNotReach: allBut("zones") },
    { from: "lexicon", mayNotReach: allBut("lexicon") },
    { from: "adapters", mayNotReach: allBut("adapters") },
    { from: "project", mayNotReach: allBut("project", "graph", "zones", "lexicon", "report") },
    { from: "report", mayNotReach: allBut("report", "graph", "zones") },
    { from: "ratchet", mayNotReach: allBut("ratchet", "report") },
    { from: "guard", mayNotReach: allBut("guard", "report") },
    { from: "claims", mayNotReach: allBut("claims", "graph", "zones", "lexicon", "project", "report") },
    { from: "config", mayNotReach: allBut("config", "claims", "zones", "project") },
    { from: "cli", mayNotReach: allBut("cli", "config", "report", "ratchet", "guard", "adapters", "root") },
  ],
});
