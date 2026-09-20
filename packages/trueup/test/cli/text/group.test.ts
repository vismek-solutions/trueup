import { describe, expect, it } from "vitest";
import { EXIT_BAD_USAGE, EXIT_CLEAN } from "../../../src/cli/command.ts";
import { runText } from "../../../src/cli/text/run.ts";
import { fixtureAt } from "../../support/fixtures.ts";

const PROJECT = fixtureAt("project");

const capture = async (argv: readonly string[]) => {
  const lines: string[] = [];
  const code = await runText({ cwd: PROJECT, argv, write: (line) => lines.push(line) });
  return { code, output: lines.join("\n") };
};

describe("reaching the prose commands through one name", () => {
  it("names the commands under it when asked for help", async () => {
    const { code, output } = await capture(["--help"]);

    expect(code).toBe(EXIT_CLEAN);
    expect(output).toContain("usage: trueup text <command> [arguments]");
    expect(output).toContain("  calibrate               what your own prose measures");
  });

  it("names them for a bare group as well, rather than doing nothing", async () => {
    const { code, output } = await capture([]);

    expect(code).toBe(EXIT_CLEAN);
    expect(output).toContain("  calibrate               what your own prose measures");
  });

  it("refuses a command it does not know", async () => {
    const { code, output } = await capture(["measure"]);

    expect(code).toBe(EXIT_BAD_USAGE);
    expect(output).toContain("unrecognised: measure");
  });

  it("hands the rest of the arguments to the command it found", async () => {
    const { code, output } = await capture(["calibrate", "--everything"]);

    expect(code).toBe(EXIT_BAD_USAGE);
    expect(output).toContain("usage: trueup text calibrate");
  });
});
