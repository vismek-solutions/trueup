import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  zones: [{ name: "app", patterns: ["lib.ts", "twin.ts", "barrel.ts", "reader.ts", "nested/**"] }],
});
