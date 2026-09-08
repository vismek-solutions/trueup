import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  zones: [
    { name: "api", patterns: ["src/index.ts"], role: "api" },
    { name: "features", patterns: ["src/features/**"], role: "api" },
    { name: "inside", patterns: ["src/**"] },
  ],
});
