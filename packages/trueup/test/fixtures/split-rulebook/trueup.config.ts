import { defineConfig } from "../../../src/config/model.ts";
import { fromAnEmittedModule } from "./extra.mjs";
import { fromASiblingFile } from "./rules.js";

export default defineConfig({
  include: ["src"],
  zones: [{ name: "engine", patterns: ["src/**"] }],
  rules: [fromASiblingFile, fromAnEmittedModule],
});
