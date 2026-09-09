import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  zones: [
    { name: "twice", patterns: ["src/a/**"] },
    { name: "twice", patterns: ["src/b/**"] },
  ],
});
