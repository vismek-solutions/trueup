import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  zones: [
    { name: "a", patterns: ["src/a.ts"] },
    { name: "b", patterns: ["src/b.ts"] },
    { name: "c", patterns: ["src/c.ts"] },
    { name: "d", patterns: ["src/d.ts"] },
    { name: "e", patterns: ["src/e.ts"] },
    { name: "f", patterns: ["src/f.ts"] },
    { name: "g", patterns: ["src/g.ts"] },
  ],
  boundaries: [
    { from: "a", allow: ["b", "c", "d", "e", "f"] },
    { from: "b", allow: ["c", "d", "e", "f"] },
  ],
});
