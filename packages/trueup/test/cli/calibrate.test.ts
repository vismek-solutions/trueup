import { describe, expect, it } from "vitest";
import { runCalibrate } from "../../src/cli/calibrate/run.ts";
import { EXIT_BAD_USAGE, EXIT_CLEAN } from "../../src/cli/command.ts";
import { fixtureAt } from "../support/fixtures.ts";

const TEXT = fixtureAt("guarded-text");
const PLAIN = fixtureAt("calibrated");
const NO_TEXT = fixtureAt("project");

const capture = async (cwd: string, argv: readonly string[] = []) => {
  const lines: string[] = [];
  const code = await runCalibrate({ cwd, argv, write: (line) => lines.push(line) });
  return { code, output: lines.join("\n") };
};

describe("reporting what a project's own prose measures", () => {
  it("names the files it read", async () => {
    const { output } = await capture(TEXT);

    expect(output).toContain("calibration  docs/**/*.md");
  });

  it("counts every sentence and every paragraph it measured", async () => {
    const { output } = await capture(TEXT);

    expect(output).toMatch(/sentence words\s+\d+ measured/);
    expect(output).toMatch(/paragraph sentences\s+\d+ measured/);
  });

  it("says what the configured limit reports, which is what the claim reports", async () => {
    const { output } = await capture(TEXT);

    expect(output).toContain("at 12 (configured) 4 over");
  });

  it("offers a percentile of the project's own writing beside it", async () => {
    const { output } = await capture(TEXT);

    expect(output).toContain("(p90)");
    expect(output).toContain("(p95)");
    expect(output).toContain("(max)");
  });

  it("shows a metric with nothing to measure rather than leaving it out", async () => {
    const { output } = await capture(PLAIN);

    expect(output).toContain("inline code words             0 measured");
  });

  it("says a rulebook with no text section has nothing to calibrate", async () => {
    const { code, output } = await capture(NO_TEXT);

    expect(code).toBe(EXIT_CLEAN);
    expect(output).toBe("this rulebook declares no text section, so there is nothing to calibrate");
  });

  it("refuses an argument it does not know", async () => {
    const { code, output } = await capture(TEXT, ["--everything"]);

    expect(code).toBe(EXIT_BAD_USAGE);
    expect(output).toContain("unrecognised: --everything");
  });
});
