import { describe, expect, it } from "vitest";
import { EXIT_BAD_USAGE } from "../../../src/cli/command.ts";
import { EXPLAINED, explainIn, saidBy, UNRULED } from "../../support/explain.ts";

const gaps = (cwd: string) => saidBy(cwd, "--ungoverned");

describe("finding the boundaries nobody wrote", () => {
  it("ranks the pairs no rule speaks about, heaviest first", async () => {
    const said = (await gaps(UNRULED)).split("\n");
    const from = said.indexOf("ungoverned  no rule speaks about these pairs");

    expect(said.slice(from + 1, from + 5)).toEqual([
      "    loose → core     3",
      "    core → tools     2",
      "    extra → core     1",
      "    extra → tools    1",
    ]);
  });

  it("settles two pairs from one zone by where they reach, not by the order they were found", async () => {
    const said = (await gaps(UNRULED)).split("\n");
    const core = said.indexOf("    extra → core     1");

    expect(said[core + 1]).toBe("    extra → tools    1");
  });

  it("sorts what a rule permits too, so neither list drifts run to run", async () => {
    const said = (await gaps(UNRULED)).split("\n");
    const from = said.indexOf("allowed     a rule permits these, so someone decided");

    expect(said.slice(from + 1, from + 3)).toEqual([
      "    aardvark → core  1",
      "    web → core       1",
    ]);
  });

  it("counts nothing for a zone reaching itself, which every zone may always do", async () => {
    expect(await gaps(UNRULED)).not.toContain("core → core");
  });

  it("counts nothing for an edge leaving a file no zone claims", async () => {
    const said = (await gaps(UNRULED)).split("\n");

    expect(said.filter((line) => line.includes("→ core"))).toEqual([
      "    loose → core     3",
      "    extra → core     1",
      "    aardvark → core  1",
      "    web → core       1",
    ]);
  });

  it("counts nothing for a reach into something no zone declares, like a builtin", async () => {
    const said = (await gaps(UNRULED)).split("\n");

    expect(said.filter((line) => line.startsWith("    core →"))).toEqual(["    core → tools     2"]);
  });

  it("leaves out a pair a rule already refuses, since that is a violation and not a gap", async () => {
    expect(await gaps(UNRULED)).not.toContain("web → tools");
  });

  it("keeps a pair some rule permits apart from one nothing governs", async () => {
    const said = (await gaps(UNRULED)).split("\n");
    const from = said.indexOf("allowed     a rule permits these, so someone decided");

    expect(said.slice(from + 1, from + 3)).toContain("    web → core       1");
    expect(said.slice(0, from)).not.toContain("    web → core       1");
  });

  it("counts a pair as ungoverned when the rule naming that zone judges only other zones", async () => {
    const said = (await gaps(UNRULED)).split("\n");
    const governed = said.indexOf("allowed     a rule permits these, so someone decided");

    expect(said.slice(0, governed)).toContain("    loose → core     3");
  });

  it("names every zone no boundary rule mentions, and only those", async () => {
    const said = (await gaps(UNRULED)).split("\n");
    const from = said.indexOf("silent      named by no boundary rule, so they may reach anything");

    expect(said.slice(from + 1).filter((line) => line !== "")).toEqual([
      "    core",
      "    tools",
      "    extra",
    ]);
  });

  it("still finds ungoverned zones in a project where every claim holds", async () => {
    const said = await gaps(EXPLAINED);

    expect(said).toContain("ungoverned  none");
    expect(said.split("\n")).toContain("    domain");
  });

  it("says so plainly rather than printing an empty column when a section is bare", async () => {
    expect(await gaps(EXPLAINED)).toContain("allowed     none");
  });

  it("reports a clean run, since a missing boundary is a question and not a failure", async () => {
    expect((await explainIn(UNRULED, ["--ungoverned"])).code).toBe(0);
  });

  it("still refuses a flag it does not know when asked for the gaps", async () => {
    const { code, output } = await explainIn(UNRULED, ["--ungoverned", "--verbose"]);

    expect(code).toBe(EXIT_BAD_USAGE);
    expect(output).toContain("unrecognised: --verbose");
  });
});
