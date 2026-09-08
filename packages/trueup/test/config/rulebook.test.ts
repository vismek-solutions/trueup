import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/load.ts";
import { EXIT_BAD_RULEBOOK } from "../../src/cli/command.ts";
import { runCli } from "../../src/cli/main.ts";
import { runActivate } from "../../src/cli/activate.ts";
import { fixtureAt } from "../support/fixtures.ts";

const SPLIT = fixtureAt("split-rulebook");
const BROKEN = fixtureAt("broken-rulebook");

const spoken = async (cwd: string): Promise<readonly string[]> => {
  const lines: string[] = [];
  await runCli({ cwd, argv: ["--dots"], write: (line) => lines.push(line) });
  return lines.join("\n").split("\n");
};

describe("a rulebook split across files", () => {
  it("resolves a sibling written the way TypeScript says to write it", async () => {
    const { config } = await loadConfig(join(SPLIT, "trueup.config.ts"));

    expect((config.rules ?? []).map((rule) => rule.name)).toEqual([
      "from-a-sibling-file",
      "from-an-emitted-module",
    ]);
  });

  it("runs the rules that sibling declared, rather than loading it and dropping them", async () => {
    let json = "";
    await runCli({ cwd: SPLIT, argv: ["--json"], write: (line) => (json += line) });
    const claims: string[] = JSON.parse(json).claims.map((claim: { claim: string }) => claim.claim);

    expect(claims).toContain("from-a-sibling-file");
    expect(claims).toContain("from-an-emitted-module");
  });

});

describe("a rulebook that will not load", () => {
  it("says so, and says what it means, rather than printing a stack trace", async () => {
    const said = await spoken(BROKEN);

    expect(said[0]).toBe("the rulebook was found but could not be read, so nothing was checked");
    expect(said[2]).toBe("  Until it loads, every rule it declares is off, and no run will say so.");
  });

  it("names the rulebook and keeps the reason the import actually gave", async () => {
    const said = (await spoken(BROKEN)).join("\n");

    expect(said).toContain(join(BROKEN, "trueup.config.ts"));
    expect(said).toContain("no-such-sibling.js");
  });

  it("reports its own exit code, so a clean run cannot be mistaken for one", async () => {
    const code = await runCli({ cwd: BROKEN, argv: ["--dots"], write: () => undefined });

    expect(code).toBe(EXIT_BAD_RULEBOOK);
  });

  it("refuses the same way from a command that only reads the rulebook", async () => {
    const lines: string[] = [];
    const code = await runActivate({ cwd: BROKEN, argv: [], write: (line) => lines.push(line) });

    expect(code).toBe(EXIT_BAD_RULEBOOK);
    expect(lines[0]).toContain("could not be read");
  });
});
