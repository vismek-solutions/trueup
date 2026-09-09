import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findConfig, loadConfig, resolveInclude } from "../../src/config/load.ts";
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
  it("carries the rules its siblings declared into the run", async () => {
    const { config } = await loadConfig(join(SPLIT, "trueup.config.ts"));

    expect((config.rules ?? []).map((rule) => rule.name)).toEqual([
      "from-a-sibling-file",
      "from-an-emitted-module",
    ]);
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

  it("keeps the failure it caught attached, so the stack it came from is not lost", async () => {
    const failure = await loadConfig(join(BROKEN, "trueup.config.ts")).catch((caught: unknown) => caught);

    expect((failure as Error).cause).toBeInstanceOf(Error);
  });

  it("refuses the same way from a command that only reads the rulebook", async () => {
    const lines: string[] = [];
    const code = await runActivate({ cwd: BROKEN, argv: [], write: (line) => lines.push(line) });

    expect(code).toBe(EXIT_BAD_RULEBOOK);
    expect(lines[0]).toContain("could not be read");
  });
});

const refusalFor = async (fixture: string): Promise<string> =>
  loadConfig(join(fixtureAt(fixture), "trueup.config.ts")).then(
    () => "",
    (failure: unknown) => (failure instanceof Error ? failure.message : String(failure)),
  );

describe("a rulebook this tool cannot make sense of", () => {
  it("refuses a file that exports its configuration under any name but default", async () => {
    expect(await refusalFor("no-default-export")).toBe(
      `${join(fixtureAt("no-default-export"), "trueup.config.ts")} has no default-exported configuration object`,
    );
  });

  it("refuses a root that names neither zones nor members, which would govern nothing", async () => {
    expect(await refusalFor("zoneless-root")).toBe(
      `${join(fixtureAt("zoneless-root"), "trueup.config.ts")} declares no zones`,
    );
  });

  it("refuses a file whose default export is null, which is an object to `typeof` alone", async () => {
    expect(await refusalFor("null-default")).toBe(
      `${join(fixtureAt("null-default"), "trueup.config.ts")} has no default-exported configuration object`,
    );
  });

  it("refuses a name that is both a member and a zone, since a rule could mean either", async () => {
    expect(await refusalFor("name-clash")).toBe(
      "one is claimed twice, by two zones, two members, or one of each",
    );
  });

  it("refuses two zones sharing a name, in a rulebook with no members to compare them against", async () => {
    expect(await refusalFor("zone-clash")).toBe(
      "twice is claimed twice, by two zones, two members, or one of each",
    );
  });
});

describe("a member the root pattern found but cannot use", () => {
  it("names a directory that matched the pattern but holds no rulebook of its own", async () => {
    expect(await refusalFor("broken-members")).toContain(
      "packages/unruled matches a `members` pattern but holds no configuration file",
    );
  });

  it("names a member whose rulebook declares no zones, so nothing of it is governed", async () => {
    expect(await refusalFor("broken-members")).toContain(
      `${join(fixtureAt("broken-members"), "packages/zoneless/trueup.config.ts")} declares no zones`,
    );
  });

  it("reports both, rather than stopping at whichever member failed first", async () => {
    expect((await refusalFor("broken-members")).split("\n")).toHaveLength(2);
  });
});

describe("looking for a rulebook above the working directory", () => {
  it("gives up at the root of the filesystem rather than climbing forever", () => {
    expect(findConfig(tmpdir())).toBeNull();
  });

  it("finds one sitting in the directory it starts from", () => {
    expect(findConfig(SPLIT)).toBe(join(SPLIT, "trueup.config.ts"));
  });

  it("climbs out of a subdirectory to find one, rather than giving up where it started", () => {
    const project = fixtureAt("explained");

    expect(findConfig(join(project, "src/engine"))).toBe(join(project, "trueup.config.ts"));
  });
});

describe("the roots a rulebook says to read", () => {
  it("reads an empty include list as the whole project, rather than as nothing at all", () => {
    expect(resolveInclude("/p", [])).toEqual(["/p"]);
  });

  it("keeps an absolute entry as it stands, and hangs a relative one off the project", () => {
    expect(resolveInclude("/p", ["/elsewhere", "src"])).toEqual(["/elsewhere", join("/p", "src")]);
  });
});
