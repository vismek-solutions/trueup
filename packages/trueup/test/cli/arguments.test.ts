import { describe, expect, it } from "vitest";
import { EXIT_BAD_USAGE, EXIT_CLEAN, EXIT_ERRORS } from "../../src/cli/command.ts";
import { runCli } from "../../src/cli/main.ts";
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

const HELP = [
  "trueup — checks that the code matches the architecture its rulebook describes",
  "",
  "usage: trueup [options]",
  "       trueup <command> [arguments]",
  "",
  "options",
  "  --dots              one mark per claim, with detail only for what failed",
  "  --next              the first problem to fix, with the remedy for it",
  "  --next=<claim>      the first problem from claims whose name contains <claim>",
  "  --json              the whole report as JSON",
  "  --gitlab            the report as a GitLab code quality artifact",
  "  --update-baseline   accept every finding standing now, so only new ones fail",
  "  --config=<path>     read this rulebook instead of searching upward for one",
  "  --help              this text",
  "",
  "commands",
  "  init                write a rulebook for this project by reading its shape",
  "  explain <path>      the zone a path falls in, what it may reach, and what it may not name",
  "  activate            every zone, boundary and setting in force, for an agent's context",
  "  guard               rule on a proposed edit, reading a hook payload from stdin",
  "  agent-instructions  a short block to paste into an agent's memory file",
  "",
  "Exit codes: 0 clean · 1 errors · 2 the baseline has entries nothing reports any more ·",
  "3 no rulebook found · 4 an argument it does not know · 5 the rulebook would not load.",
];

describe("telling an agent what it can ask for", () => {
  it("names every flag and command it accepts", async () => {
    expect((await spoken(VIOLATING, "--help")).join("\n")).toBe(HELP.join("\n"));
  });

  it("takes the short form too", async () => {
    expect((await spoken(VIOLATING, "-h")).join("\n")).toBe(HELP.join("\n"));
  });

  it("reports a clean run, since asking what it can do is not a failure", async () => {
    expect(await codeFor(VIOLATING, "--help")).toBe(EXIT_CLEAN);
  });
});

describe("refusing an argument it does not know", () => {
  it("names the argument it could not read, then everything it can", async () => {
    const said = await spoken(VIOLATING, "--nex");

    expect(said).toEqual(["unrecognised: --nex", "", ...HELP]);
  });

  it("names every argument it could not read, not just the first", async () => {
    const said = await spoken(VIOLATING, "--nex", "--dtos");

    expect(said[0]).toBe("unrecognised: --nex --dtos");
  });

  it("writes nothing and reports bad usage", async () => {
    expect(await codeFor(VIOLATING, "--nex")).toBe(EXIT_BAD_USAGE);
  });
});
