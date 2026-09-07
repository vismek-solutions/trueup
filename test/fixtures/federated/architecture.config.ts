import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["packages", "apps"],
  members: ["packages/*", "apps/*"],
  zones: [],
  boundaries: [{ from: "docs", mayNotReach: ["lib"], anchor: "imported-module" }],
});
