import { defineConfig } from "../../../src/config/model.ts";

export default defineConfig({
  zones: [{ name: "app", patterns: ["src/**"] }],
  isolate: [
    {
      siblings: "src/routes/*",
      except: ["_ui", { shared: "_state", allow: [] }, { shared: "_root", allow: ["_state"] }],
    },
  ],
});
