import { defineMember } from "../../../../../src/config/model.ts";

export default defineMember({
  zones: [{ name: "app", patterns: ["src/**"] }],
  isolate: [{ siblings: "src/routes/*", except: ["shared"], wiring: ["src/routes/index.ts"] }],
  maxFilesPerDirectory: 2,
});
