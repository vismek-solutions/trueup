import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  allow: ["keeps-core", "keeps-nameless", "keeps-plain"],
  zones: [{ name: "src", patterns: ["src/**"] }],
});
