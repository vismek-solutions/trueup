import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "web", patterns: ["src/web/**"] },
    { name: "core", patterns: ["src/core/**"] },
    { name: "tools", patterns: ["src/tools/**"] },
    { name: "loose", patterns: ["src/loose/**"] },
    { name: "extra", patterns: ["src/extra/**"] },
    { name: "aardvark", patterns: ["src/zz/**"] },
  ],
  boundaries: [
    { from: "web", allow: ["core"] },
    { from: "loose", allow: [], governs: ["tools"] },
    { from: "aardvark", allow: ["core"] },
  ],
});
