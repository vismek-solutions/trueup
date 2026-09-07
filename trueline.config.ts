import { biomeRunner } from "./packages/trueline/src/adapters/biome-runner.ts";
import { fallowRunner } from "./packages/trueline/src/adapters/fallow-runner.ts";
import { IGNORED_DIRECTORIES } from "./packages/trueline/src/adapters/node-files.ts";
import { oxlintRunner } from "./packages/trueline/src/adapters/oxlint-runner.ts";
import { defineConfig } from "./packages/trueline/src/config/model.ts";

const PATHS = ["packages/trueline/src", "packages/trueline/test", "packages/trueline/bin"];

export default defineConfig({
  members: ["packages/*"],
  ignoreDirectories: [...IGNORED_DIRECTORIES, "fixtures"],
  command: "node ./packages/trueline/bin/trueline.js",
  maxFilesPerDirectory: 12,
  duplication: 60,
  colocation: true,
  runners: [
    biomeRunner({
      command: ["node_modules/.bin/biome", "lint"],
      paths: PATHS,
      write: process.env.CI === undefined,
    }),
    fallowRunner({
      command: ["node_modules/.bin/fallow"],
      duplication: { mode: "weak", minLines: 5, minTokens: 30 },
    }),
    oxlintRunner({
      command: ["node_modules/.bin/oxlint"],
      paths: PATHS,
      categories: ["eslint/max-params"],
    }),
  ],
});
