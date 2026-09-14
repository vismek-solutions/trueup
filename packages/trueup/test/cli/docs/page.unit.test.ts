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

  it("takes the claims a page says it explains", () => {
    const source = "---\ntitle: Placement\nclaims:\n  - no-test-reaches-an-internal\n  - no-export-exists-only-for-a-test\ndescription: Where.\n---\n\nThe body.\n";

    expect(pageFrom("checks/placement", source)).toMatchObject({
      claims: ["no-test-reaches-an-internal", "no-export-exists-only-for-a-test"],
      description: "Where.",
      body: "The body.",
    });
  });

  it("leaves the claims empty for a page that names none", () => {
    expect(pageFrom("loose", "---\ntitle: Loose\n---\n\nProse.\n").claims).toEqual([]);
  });
});
