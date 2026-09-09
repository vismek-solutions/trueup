import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  doorsFromExports: false,
  zones: [{ name: "api", patterns: ["src/**"], role: "api" }],
});
