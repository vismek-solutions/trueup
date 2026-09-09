import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src", "tools"],
  zones: [
    { name: "engine", patterns: ["src/engine/**"] },
    { name: "domain", patterns: ["src/domain/**"] },
    { name: "tools", patterns: ["tools/**"] },
  ],
  boundaries: [
    { from: "engine", allow: [] },
    { from: "tools", allow: [] },
  ],
});
