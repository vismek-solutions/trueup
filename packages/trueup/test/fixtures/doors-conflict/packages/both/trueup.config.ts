import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  doorsFromExports: true,
  zones: [
    { name: "front", patterns: ["src/index.ts"], role: "api" },
    { name: "inside", patterns: ["src/**"] },
  ],
});
