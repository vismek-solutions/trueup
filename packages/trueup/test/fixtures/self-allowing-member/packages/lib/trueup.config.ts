import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  allow: ["lib"],
  zones: [{ name: "api", patterns: ["src/index.ts"], role: "api" }],
});
