import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  doorsFromExports: true,
  zones: [{ name: "inside", patterns: ["src/**"] }],
});
