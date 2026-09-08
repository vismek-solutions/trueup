import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  allow: ["lib"],
  zones: [{ name: "pages", patterns: ["src/**"] }],
});
