import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  members: ["apps/*", "libs/*"],
  colocation: true,
});
