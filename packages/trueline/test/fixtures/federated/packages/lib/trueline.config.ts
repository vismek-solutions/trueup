import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  mayReach: ["ui"],
  zones: [
    { name: "api", patterns: ["src/index.ts"], role: "api" },
    { name: "domain", patterns: ["src/domain/**"] },
    { name: "engine", patterns: ["src/engine/**"] },
  ],
  boundaries: [{ from: "domain", mayNotReach: ["engine"] }],
});
