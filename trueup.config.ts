import { biomeRunner } from "./packages/trueup/src/adapters/biome-runner.ts";
import { FALLOW_CATEGORIES, fallowRunner } from "./packages/trueup/src/adapters/fallow-runner.ts";
import { IGNORED_DIRECTORIES } from "./packages/trueup/src/adapters/node-files.ts";
import { oxlintRunner } from "./packages/trueup/src/adapters/oxlint-runner.ts";
import { defineConfig } from "./packages/trueup/src/config/model.ts";

const PATHS = ["packages/trueup/src", "packages/trueup/test", "packages/trueup/bin", "scripts"];

const PLAINER = [
  { word: "leverage", instead: "use" },
  { word: "utilize", instead: "use" },
  { word: "facilitate", instead: "help" },
  { word: "delve", instead: "look at" },
  { word: "occludes", instead: "hides" },
  { word: "robust", instead: "solid" },
  { word: "seamless", instead: "smooth" },
  { word: "seamlessly", instead: "smoothly" },
  { word: "powerful", instead: "a plain description of what it does" },
  { word: "comprehensive", instead: "complete" },
  { word: "crucial", instead: "important" },
  { word: "vital", instead: "important" },
  { word: "simply", instead: "nothing, and delete the word" },
  { word: "easily", instead: "nothing, and delete the word" },
  { word: "effortlessly", instead: "nothing, and delete the word" },
  { word: "myriad", instead: "many" },
  { word: "plethora", instead: "many" },
  { word: "landscape", instead: "a plain noun" },
  { word: "realm", instead: "a plain noun" },
  { word: "tapestry", instead: "a plain noun" },
  { word: "unlock", instead: "a plain verb" },
  { word: "elevate", instead: "a plain verb" },
  { word: "streamline", instead: "simplify" },
];

export default defineConfig({
  members: ["packages/*"],
  zones: [
    { name: "docs", patterns: ["apps/docs/**"] },
    { name: "scripts", patterns: ["scripts/**"], role: "wiring" },
  ],
  boundaries: [
    { from: "docs", allow: [] },
    { from: "scripts", allow: [] },
  ],
  externals: ["astro:*"],
  ignoreDirectories: [...IGNORED_DIRECTORIES, "fixtures", ".astro", ".stryker-tmp"],
  command: "node ./packages/trueup/bin/trueup.js",
  protect: ["CLAUDE.md", ".claude/settings.json"],
  maxFilesPerDirectory: 12,
  duplication: 60,
  readerships: true,
  colocation: true,
  testInternals: true,
  text: {
    files: ["apps/docs/**/*.md", "README.md"],
    marks: ["—", "–", "--", "·"],
    words: PLAINER,
    maxInlineCodeWords: 4,
    echo: 0.6,
  },
  runners: [
    biomeRunner({
      command: ["node_modules/.bin/biome", "lint"],
      paths: PATHS,
      write: process.env.CI === undefined,
    }),
    fallowRunner({
      command: ["node_modules/.bin/fallow"],
      categories: [...FALLOW_CATEGORIES],
      duplication: {},
    }),
    oxlintRunner({
      command: ["node_modules/.bin/oxlint"],
      paths: PATHS,
      write: process.env.CI === undefined,
    }),
  ],
});
