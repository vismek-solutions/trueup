import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  allow: ["lib", "ui"],
  zones: [{ name: "pages", patterns: ["src/**"] }],
});
