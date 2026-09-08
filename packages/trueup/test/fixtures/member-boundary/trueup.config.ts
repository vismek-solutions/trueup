import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["packages", "docs"],
  members: ["packages/*"],
  zones: [
    { name: "guide", patterns: ["docs/guide/**"] },
    { name: "notes", patterns: ["docs/notes/**"] },
  ],
  boundaries: [
    { from: "web", allow: ["lib"] },
    { from: "guide", allow: ["notes"] },
  ],
});
