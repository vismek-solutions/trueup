import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  allow: ["typo"],
  zones: [{ name: "api", patterns: ["src/index.ts"], role: "api" }],
});
