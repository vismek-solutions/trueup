import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  allow: ["ui"],
  zones: [{ name: "inside", patterns: ["src/**"] }],
});
