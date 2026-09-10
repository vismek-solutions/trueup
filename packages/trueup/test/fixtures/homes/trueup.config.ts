import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "ui", patterns: ["src/ui/**"] },
    { name: "api", patterns: ["src/api/**"] },
    { name: "store", patterns: ["src/store/**"] },
    { name: "domain", patterns: ["src/domain/**"] },
  ],
  boundaries: [
    { from: "ui", allow: ["api"] },
    { from: "api", allow: ["domain"] },
    { from: "store", allow: ["domain"] },
    { from: "domain", allow: [] },
  ],
});
