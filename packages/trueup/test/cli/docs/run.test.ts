import { describe, expect, it } from "vitest";
import { pagesIn } from "../../../src/cli/docs/location.ts";
import { pageFrom } from "../../../src/cli/docs/page.ts";
import { runDocs } from "../../../src/cli/docs/run.ts";

const capture = (argv: readonly string[]): { code: number; output: string } => {
  let output = "";
  const code = runDocs({ cwd: process.cwd(), argv, write: (line) => (output += `${line}\n`) });
  return { code, output };
};

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

describe("the docs command", () => {
  it("lists every page with a line about it", () => {
    const { code, output } = capture([]);

    expect(code).toBe(0);
    expect(output).toContain("concepts/zones");
    expect(output).toMatch(/concepts\/zones\s+\S.*\S/);
  });

  it("prints one page when a topic names it, without its path", () => {
    const { code, output } = capture(["zones"]);

    expect(code).toBe(0);
    expect(output).toContain("# Zones");
    expect(output).not.toContain("title: Zones");
  });

  it("lists the candidates when a term appears on more than one page", () => {
    const { code, output } = capture(["no-file-serves-two-readerships"]);

    expect(code).toBe(0);
    expect(output).toContain("checks/placement");
    expect(output).toContain("checks/index");
  });

  it("falls back to the list when nothing covers the term", () => {
    const { code, output } = capture(["nothing-here-covers-this"]);

    expect(code).toBe(4);
    expect(output).toContain("no page covers nothing-here-covers-this");
    expect(output).toContain("concepts/zones");
  });

  it("refuses a second argument rather than ignoring it", () => {
    const { code, output } = capture(["zones", "boundaries"]);

    expect(code).toBe(4);
    expect(output).toContain("unrecognised: zones boundaries");
  });
});
