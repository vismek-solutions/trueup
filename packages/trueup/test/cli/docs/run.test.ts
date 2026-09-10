import { describe, expect, it } from "vitest";
import { pagesIn } from "../../../src/cli/docs/location.ts";
import { pageFrom } from "../../../src/cli/docs/page.ts";

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

describe("reading a page", () => {
  it("takes the title and description out of the frontmatter", () => {
    const page = pageFrom("checks/seams", "---\ntitle: Seams\ndescription: What leaks.\n---\n\nThe body.\n");

    expect(page).toMatchObject({ title: "Seams", description: "What leaks.", body: "The body." });
  });

  it("keeps a page that has no frontmatter whole", () => {
    expect(pageFrom("loose", "Just prose.\n").body).toBe("Just prose.");
  });
});
