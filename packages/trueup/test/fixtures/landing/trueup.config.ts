import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  zones: [
    { name: "store", patterns: ["src/store/**"] },
    { name: "lib", patterns: ["src/lib/**"] },
    { name: "app", patterns: ["src/app/**"] },
    { name: "web", patterns: ["src/web/**"] },
    { name: "wiring", patterns: ["src/wiring/**"], role: "wiring" },
  ],
  boundaries: [
    { from: "wiring", allow: ["lib", "store", "app", "web"] },
    { from: "web", allow: ["lib", "store"] },
    { from: "app", allow: ["lib", "store"] },
    { from: "lib", allow: ["store"] },
    { from: "store", allow: [] },
  ],
  colocation: true,
});
