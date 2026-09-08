import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  zones: [
    { name: "api", patterns: ["src/index.ts", "src/warrants.ts"], role: "api" },
    { name: "inside", patterns: ["src/**"] },
  ],
});
