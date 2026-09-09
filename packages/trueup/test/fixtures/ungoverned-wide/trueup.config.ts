import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["src"],
  zones: [
    { name: "a", patterns: ["src/a/**"] },
    { name: "b", patterns: ["src/b/**"] },
    { name: "c", patterns: ["src/c/**"] },
    { name: "d", patterns: ["src/d/**"] },
    { name: "e", patterns: ["src/e/**"] },
    { name: "f", patterns: ["src/f/**"] },
  ],
  boundaries: [
    { from: "a", allow: [], governs: ["b"] },
    { from: "b", allow: [], governs: ["c"] },
    { from: "c", allow: [], governs: ["d"] },
    { from: "d", allow: [], governs: ["e"] },
    { from: "e", allow: [], governs: ["f"] },
    { from: "f", allow: [], governs: ["a"] },
  ],
});
