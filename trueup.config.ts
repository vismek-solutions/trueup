import { biomeRunner } from "./packages/trueup/src/adapters/biome-runner.ts";
import { FALLOW_CATEGORIES, fallowRunner } from "./packages/trueup/src/adapters/fallow-runner.ts";
import { IGNORED_DIRECTORIES } from "./packages/trueup/src/adapters/node-files.ts";
import { oxlintRunner } from "./packages/trueup/src/adapters/oxlint-runner.ts";
import { defineConfig } from "./packages/trueup/src/config/model.ts";

const PATHS = ["packages/trueup/src", "packages/trueup/test", "packages/trueup/bin"];

export default defineConfig({
  members: ["packages/*"],
  zones: [{ name: "docs", patterns: ["apps/docs/**"] }],
  boundaries: [{ from: "docs", allow: [] }],
  externals: ["astro:*"],
  ignoreDirectories: [...IGNORED_DIRECTORIES, "fixtures", ".astro", ".stryker-tmp"],
  command: "node ./packages/trueup/bin/trueup.js",
  maxFilesPerDirectory: 12,
  duplication: 60,
  readerships: true,
  colocation: true,
  testInternals: true,
  runners: [
    biomeRunner({
      command: ["node_modules/.bin/biome", "lint"],
      paths: PATHS,
      write: process.env.CI === undefined,
    }),
    fallowRunner({
      command: ["node_modules/.bin/fallow"],
      categories: [...FALLOW_CATEGORIES],
      duplication: { mode: "weak", minLines: 5, minTokens: 30 },
    }),
    oxlintRunner({
      command: ["node_modules/.bin/oxlint"],
      paths: PATHS,
      categories: ["eslint/max-params"],
      write: process.env.CI === undefined,
    }),
  ],
});
