import { describe, expect, it } from "vitest";
import { pagesIn } from "../../../src/cli/docs/location.ts";

describe("finding the guides in both layouts", () => {
  it("reads them from the workspace while running off the TypeScript sources", () => {
    expect(pagesIn("/w/packages/trueup/src/cli/docs", "/w/packages/trueup/src/cli/docs/pages.ts")).toBe(
      "/w/apps/docs/src/content/docs",
    );
  });

  it("reads them from the published package once the sources are emitted", () => {
    expect(pagesIn("/p/node_modules/trueup/dist/cli/docs", "/p/node_modules/trueup/dist/cli/docs/pages.js")).toBe(
      "/p/node_modules/trueup/dist/docs",
    );
  });
});
