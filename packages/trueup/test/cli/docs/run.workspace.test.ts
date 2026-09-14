import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allPages } from "../../../src/cli/docs/pages.ts";
import { runDocs } from "../../../src/cli/docs/run.ts";

const GUIDES = fileURLToPath(new URL("../../../../../apps/docs/src/content/docs", import.meta.url));

const claimsDeclared = (): readonly string[] => allPages(GUIDES).flatMap((page) => page.claims);

const capture = (argv: readonly string[]): { code: number; output: string } => {
  let output = "";
  const code = runDocs({ cwd: process.cwd(), argv, write: (line) => (output += `${line}\n`) });
  return { code, output };
};

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

  it("prints the page that explains a claim, rather than every page that mentions it", () => {
    const { code, output } = capture(["no-file-serves-two-readerships"]);

    expect(code).toBe(0);
    expect(output).toContain("# Placement");
    expect(output).not.toContain("checks/index");
  });

  it("lists the candidates when a term appears on more than one page", () => {
    const { code, output } = capture(["tsconfig"]);

    expect(code).toBe(0);
    expect(output).toContain("concepts/boundaries");
    expect(output).toContain("start/getting-started");
  });

  it("falls back to the list when nothing covers the term", () => {
    const { code, output } = capture(["nothing-here-covers-this"]);

    expect(code).toBe(4);
    expect(output).toContain("no page covers nothing-here-covers-this");
    expect(output).toContain("concepts/zones");
  });

  it("leaves every claim owned by one page, so no claim name lands on a menu", () => {
    const declared = claimsDeclared();
    const twice = declared.filter((claim, index) => declared.indexOf(claim) !== index);

    expect(declared.length).toBeGreaterThan(0);
    expect(twice).toEqual([]);
  });

  it("prints a page for every claim a guide says it explains", () => {
    const unresolved = claimsDeclared().filter((claim) => !capture([claim]).output.startsWith("# "));

    expect(unresolved).toEqual([]);
  });

  it("refuses a second argument rather than ignoring it", () => {
    const { code, output } = capture(["zones", "boundaries"]);

    expect(code).toBe(4);
    expect(output).toContain("unrecognised: zones boundaries");
  });
});
