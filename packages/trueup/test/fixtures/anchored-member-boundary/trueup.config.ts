import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  include: ["packages"],
  members: ["packages/*"],
  boundaries: [{ from: "web", allow: ["lib"], anchor: "declaring-file" }],
});
