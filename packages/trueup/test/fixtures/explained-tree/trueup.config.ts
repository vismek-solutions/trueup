import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "app/ui", patterns: ["src/app/ui/**"] },
    { name: "app", patterns: ["src/app/**"] },
    { name: "lib/data", patterns: ["src/lib/data/**"] },
    { name: "lib/net/http", patterns: ["src/lib/net/http/**"] },
    { name: "tools", patterns: ["src/tools/**"] },
  ],
  boundaries: [],
});
