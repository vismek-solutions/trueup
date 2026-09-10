import { describe, expect, it } from "vitest";
import { runDocs } from "../../../src/cli/docs/run.ts";

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
