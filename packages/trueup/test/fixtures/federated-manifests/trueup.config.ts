import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["packages", "apps", "scripts"],
  members: ["packages/keeps-*", "apps/*/web"],
  zones: [{ name: "tooling", patterns: ["scripts/**"] }],
  boundaries: [
    { from: "keeps-core", allow: ["tooling"] },
    { from: "tooling", allow: ["keeps-core"] },
  ],
});
