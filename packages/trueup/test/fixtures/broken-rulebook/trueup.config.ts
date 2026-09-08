import { defineConfig } from "../../../src/config/model.ts";
import { nothing } from "./no-such-sibling.js";

export default defineConfig({
  zones: [{ name: "engine", patterns: ["src/**"] }],
  rules: [nothing],
});
