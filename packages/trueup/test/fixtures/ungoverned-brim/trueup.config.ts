import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "a", patterns: ["src/a/**"] },
    { name: "b", patterns: ["src/b/**"] },
    { name: "c", patterns: ["src/c/**"] },
    { name: "d", patterns: ["src/d/**"] },
    { name: "e", patterns: ["src/e/**"] },
  ],
});
