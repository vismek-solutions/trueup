import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  zones: [{ name: "api", patterns: ["src/**"], role: "api" }],
});
