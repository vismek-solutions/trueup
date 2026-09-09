import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  isolate: [{ siblings: "src/engine/*" }],
  zones: [
    { name: "api", patterns: ["src/index.ts"], role: "api" },
    { name: "engine", patterns: ["src/engine/**"] },
  ],
});
