import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  zones: [
    { name: "app/pages", patterns: ["src/pages/**"] },
    { name: "lib/read", patterns: ["src/read/**"] },
    { name: "lib/write", patterns: ["src/write/**"] },
    { name: "tools/build", patterns: ["tools/**"] },
  ],
  boundaries: [{ from: "app/pages", allow: ["lib/read", "lib/write"] }],
});
