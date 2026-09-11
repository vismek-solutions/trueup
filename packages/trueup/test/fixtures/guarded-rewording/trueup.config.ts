import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "app", patterns: ["src/app/**"] },
    { name: "lib", patterns: ["src/lib/**"] },
  ],
  colocation: true,
});
