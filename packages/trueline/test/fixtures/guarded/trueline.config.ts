import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  protect: ["locked/**"],
  zones: [
    { name: "engine", patterns: ["src/engine/**"] },
    { name: "domain", patterns: ["src/domain/**"] },
  ],
  boundaries: [{ from: "engine", allow: [] }],
});
