import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "entry", patterns: ["src/main.ts"] },
    { name: "ui", patterns: ["src/ui/**"] },
    { name: "api", patterns: ["src/api/**"] },
    { name: "store", patterns: ["src/store/**"] },
    { name: "domain", patterns: ["src/domain/**"] },
    { name: "mail", patterns: ["src/mail/**"] },
  ],
  boundaries: [
    { from: "entry", allow: ["ui", "domain"] },
    { from: "ui", allow: ["api"] },
    { from: "api", allow: ["domain"] },
    { from: "store", allow: ["domain"] },
    { from: "domain", allow: [] },
    { from: "mail", allow: ["domain"] },
  ],
});
