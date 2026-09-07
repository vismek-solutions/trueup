import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/main.ts";
import { fixtureAt } from "../support/fixtures.ts";

const CLEAN = fixtureAt("explained");
const VIOLATING = fixtureAt("violating");

const dots = async (cwd: string): Promise<string> => {
  let output = "";
  await runCli({ cwd, argv: ["--dots"], write: (line) => (output += `${line}\n`) });
  return output;
};

describe("reporting as dots", () => {
  it("says almost nothing when every claim holds", async () => {
    const output = await dots(CLEAN);

    expect(output.split("\n")[0]).toMatch(/^\.+ {2}\d+ files/);
    expect(output).toContain("0 errors");
  });

  it("still counts what was analysed, so silence cannot mean nothing ran", async () => {
    expect(await dots(CLEAN)).toMatch(/\d+ files · \d+ edges · 0 unresolved/);
  });

  it("marks the failing claim in the strip and explains only that one", async () => {
    const output = await dots(VIOLATING);

    expect(output.split("\n")[0]).toContain("E");
    expect(output).toContain("every-import-respects-its-zone-boundary");
    expect(output).toContain("may not reach domain");
  });

  it("leaves out the claims that passed", async () => {
    expect(await dots(VIOLATING)).not.toContain("every-zone-has-a-file  ");
  });

  it("keeps the guidance, since a finding without a remedy is half a report", async () => {
    expect(await dots(VIOLATING)).toContain("Widening the rule is not the fix");
  });
});
