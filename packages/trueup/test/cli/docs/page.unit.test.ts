import { describe, expect, it } from "vitest";
import { pageFrom } from "../../../src/cli/docs/page.ts";

describe("reading a page", () => {
  it("takes the title and description out of the frontmatter", () => {
    const page = pageFrom("checks/seams", "---\ntitle: Seams\ndescription: What leaks.\n---\n\nThe body.\n");

    expect(page).toMatchObject({ title: "Seams", description: "What leaks.", body: "The body." });
  });

  it("keeps a page that has no frontmatter whole", () => {
    expect(pageFrom("loose", "Just prose.\n").body).toBe("Just prose.");
  });
});
