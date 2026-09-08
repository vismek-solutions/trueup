import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["packages", "docs"],
  members: ["packages/*"],
  zones: [{ name: "one", patterns: ["docs/**"] }],
});
