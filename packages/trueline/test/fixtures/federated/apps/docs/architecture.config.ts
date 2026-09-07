import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  mayReach: ["lib"],
  zones: [{ name: "pages", patterns: ["src/**"] }],
});
