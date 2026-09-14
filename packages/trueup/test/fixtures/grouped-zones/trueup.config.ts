import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  zones: [
    { name: "app/pages", patterns: ["app/pages/**"] },
    { name: "lib/read", patterns: ["lib/read/**"] },
    { name: "lib/write", patterns: ["lib/write/**"] },
    { name: "tools/build", patterns: ["tools/**"] },
  ],
  boundaries: [{ from: "app/pages", allow: ["lib/read", "lib/write"] }],
});
