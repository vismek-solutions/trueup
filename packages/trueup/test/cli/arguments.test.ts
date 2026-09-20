import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXIT_BAD_USAGE, EXIT_CLEAN, EXIT_ERRORS, EXIT_NO_CONFIG } from "../../src/cli/command.ts";
import { runCli } from "../../src/cli/main.ts";
import type { Report } from "../../src/report/model.ts";
import { fixtureAt, nowhere } from "../support/fixtures.ts";

const VIOLATING = fixtureAt("violating");

const CLEAN = fixtureAt("explained");

const spoken = async (cwd: string, ...argv: readonly string[]): Promise<readonly string[]> => {
  const lines: string[] = [];
  await runCli({ cwd, argv, write: (line) => lines.push(line) });
  return lines.join("\n").split("\n");
};

const codeFor = async (cwd: string, ...argv: readonly string[]): Promise<number> =>
  runCli({ cwd, argv, write: () => undefined });

describe("handing the whole report to another program", () => {
  const parsed = async (): Promise<Report> => JSON.parse((await spoken(VIOLATING, "--json")).join("\n"));

  it("writes JSON naming the claim that failed, not the text a person reads", async () => {
    expect((await parsed()).claims.map((claim) => claim.claim)).toContain(
      "every-import-respects-its-zone-boundary",
    );
  });

  it("carries the coverage counts, so a shrunken graph is visible in the machine form too", async () => {
    expect((await parsed()).coverage.files).toBeGreaterThan(0);
  });

  it("carries a remedy only where something needs remedying, so a clean claim costs a line", async () => {
    const idle = (await parsed()).claims.filter(
      (claim) => claim.findings.length === 0 && claim.guidance !== undefined,
    );

    expect(idle).toEqual([]);
  });

  it("still carries the remedy for a claim that found something", async () => {
    const failed = (await parsed()).claims.filter((claim) => claim.findings.length > 0);

    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((claim) => (claim.guidance ?? "") !== "")).toBe(true);
  });
});

describe("being told which rulebook to read", () => {
  const config = join(VIOLATING, "trueup.config.ts");

  it("reads the file it was handed rather than searching upward from the directory", async () => {
    const said = await nowhere((cwd) => spoken(cwd, `--config=${config}`));

    expect(said.join("\n")).toContain("may not reach domain");
  });

  it("checks the tree around that rulebook, not the directory it was run from", async () => {
    const said = await nowhere((cwd) => spoken(cwd, `--config=${config}`, "--dots"));

    expect(said.join("\n")).not.toContain("no trueup.config.ts found");
  });

  it("keeps the claim filter apart from the path, whichever order the two arrive in", async () => {
    const [headline] = await nowhere((cwd) => spoken(cwd, `--config=${config}`, "--next=boundary"));

    expect(headline).toContain("in `boundary`");
  });

  it("leaves every rulebook out of the code it checks, the members' rulebooks included", async () => {
    const federated = join(fixtureAt("federated"), "trueup.config.ts");
    const said = await nowhere((cwd) => spoken(cwd, `--config=${federated}`));

    expect(said.join("\n")).not.toContain("trueup.config.ts");
  });
});

describe("finding no rulebook at all", () => {
  it("says so rather than reporting a clean run over nothing", async () => {
    expect(await nowhere((cwd) => spoken(cwd))).toEqual(["no trueup.config.ts found"]);
  });

  it("exits with a code of its own, apart from clean and from failing", async () => {
    expect(await nowhere((cwd) => codeFor(cwd))).toBe(EXIT_NO_CONFIG);
  });
});

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

  it("refuses two report flags rather than answering one and dropping the other", async () => {
    const said = await spoken(VIOLATING, "--dots", "--json");

    expect(said[0]).toBe("--dots and --json answer different questions, so give one of them");
    expect(await codeFor(VIOLATING, "--dots", "--json")).toBe(EXIT_BAD_USAGE);
  });

  it("counts the scoped and bare forms of a flag as the one report they are", async () => {
    expect(await codeFor(VIOLATING, "--next", "--next=boundary")).toBe(EXIT_ERRORS);
  });

  it("refuses a filter that named nothing, so a typo cannot pass as a clean run", async () => {
    expect(await codeFor(CLEAN, "--next=bondary")).toBe(EXIT_BAD_USAGE);
  });

  it("passes a clean run whose filter did name a claim", async () => {
    expect(await codeFor(CLEAN, "--next=zone")).toBe(EXIT_CLEAN);
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
  "  --dots                  one mark per claim, with detail only for what failed",
  "  --next                  the first problem to fix, with the remedy for it",
  "  --next=<claim>          the first problem from a claim <claim> names or turns on",
  "  --json                  the whole report as JSON",
  "  --gitlab                the report as a GitLab code quality artifact",
  "  --github                the report as SARIF, for GitHub code scanning",
  "  --update-baseline       accept every finding standing now, so only new ones fail",
  "  --config=<path>         read this rulebook instead of searching upward for one",
  "  --help                  this text",
  "",
  "commands",
  "  init                    write a rulebook for this project by reading its shape",
  "  explain <path>[#<name>] the zone a path falls in; with a name, who reads it and what a cut costs",
  "  explain --needs=<paths> where a file reaching those may live; --read-by=<paths> narrows it",
  "  explain --ungoverned    zone pairs whose traffic no boundary rule refuses, heaviest first",
  "  activate                every zone, boundary and setting in force, for an agent's context",
  "  guard                   rule on a proposed edit, reading a hook payload from stdin",
  "  agent-instructions      a short block to paste into an agent's memory file",
  "  docs [<topic>]          the guides that ship with this version, one page at a time",
  "  text <command>          the prose side of the rulebook; its own help lists what is under it",
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
