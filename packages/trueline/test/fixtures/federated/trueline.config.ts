import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["packages", "apps"],
  members: ["packages/*", "apps/*"],
  boundaries: [{ from: "lib", allow: [] }],
});
