import { describe, expect, it } from "vitest";
import { EXIT_BAD_USAGE, EXIT_ERRORS, runCli } from "../../src/cli/main.ts";
import { fixtureAt } from "../support/fixtures.ts";

const VIOLATING = fixtureAt("violating");

const spoken = async (cwd: string, ...argv: readonly string[]): Promise<readonly string[]> => {
  const lines: string[] = [];
  await runCli({ cwd, argv, write: (line) => lines.push(line) });
  return lines.join("\n").split("\n");
};

const codeFor = async (cwd: string, ...argv: readonly string[]): Promise<number> =>
  runCli({ cwd, argv, write: () => undefined });

describe("choosing which claim to fix first", () => {
  it("scopes the next problem to the claim named", async () => {
    const [headline] = await spoken(VIOLATING, "--next=boundary");

    expect(headline).toContain("in `boundary`");
    expect(headline).toContain("problem 1 of");
  });

  it("shows that claim's finding rather than another claim's", async () => {
    expect((await spoken(VIOLATING, "--next=boundary")).join("\n")).toContain(
      "every-import-respects-its-zone-boundary",
    );
  });

  it("refuses to guess when nothing matches, rather than reporting all clear", async () => {
    const [headline] = await spoken(VIOLATING, "--next=bondary");

    expect(headline).toContain("no claim matches `bondary`");
  });

  it("still fails the run when the filter hides the errors, since the view is not the verdict", async () => {
    expect(await codeFor(VIOLATING, "--next=bondary")).toBe(EXIT_ERRORS);
  });

  it("takes a bare --next as before, with nothing scoped", async () => {
    const [headline] = await spoken(VIOLATING, "--next");

    expect(headline).toContain("problem 1 of");
    expect(headline).not.toContain(" in `");
  });

  it("treats an empty filter as no filter rather than as a match on everything", async () => {
    const [headline] = await spoken(VIOLATING, "--next=");

    expect(headline).not.toContain(" in `");
  });
});

describe("refusing an argument it does not know", () => {
  it("names the filter among the arguments it accepts", async () => {
    const said = await spoken(VIOLATING, "--nex");

    expect(said[0]).toBe("unrecognised: --nex");
    expect(said[1]).toContain("--next=<claim>");
  });

  it("writes nothing and reports bad usage", async () => {
    expect(await codeFor(VIOLATING, "--nex")).toBe(EXIT_BAD_USAGE);
  });
});
