import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/main.ts";
import { fixtureAt } from "../support/fixtures.ts";

const UNGUARDED = fixtureAt("unguarded");
const GUARDED = fixtureAt("explained");

const reportOf = async (cwd: string, argv: readonly string[] = []): Promise<string> => {
  let output = "";
  await runCli({ cwd, argv: [...argv], write: (line) => (output += `${line}\n`) });
  return output;
};

describe("a project that lets an agent edit its rulebook", () => {
  it("says so in the report, so an unguarded run cannot look like a guarded one", async () => {
    expect(await reportOf(UNGUARDED)).toContain("the rulebook is unguarded");
  });

  it("says so in the dots report too, which is the one an agent reads", async () => {
    expect(await reportOf(UNGUARDED, ["--dots"])).toContain("the rulebook is unguarded");
  });

  it("stays quiet when the rulebook is guarded", async () => {
    expect(await reportOf(GUARDED)).not.toContain("unguarded");
  });
});
