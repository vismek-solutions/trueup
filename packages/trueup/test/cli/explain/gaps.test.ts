import { describe, expect, it } from "vitest";
import { EXIT_BAD_USAGE } from "../../../src/cli/command.ts";
import { EXPLAINED, explainIn, saidBy, UNRULED } from "../../support/explain.ts";
import { fixtureAt } from "../../support/fixtures.ts";

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

    expect(said.slice(from + 1, from + 3)).toEqual(["    aardvark → core  1", "    web → core       1"]);
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

  it("says the whole block for a project where every claim holds, spacing and all", async () => {
    expect(await gaps(EXPLAINED)).toBe(
      [
        "Every pair below carries traffic that no boundary rule refuses, so none of it is a violation.",
        "A heavy pair is either the architecture nobody wrote down or a hole nobody noticed, and only",
        "reading it tells you which. Counted by the zone that declares the symbol, not the module named.",
        "",
        "ungoverned  none",
        "",
        "allowed     none",
        "",
        "silent      named by no boundary rule, so they may reach anything",
        "    domain",
        "    shared",
        "",
      ].join("\n"),
    );
  });

  it("reports a clean run, since a missing boundary is a question and not a failure", async () => {
    expect((await explainIn(UNRULED, ["--ungoverned"])).code).toBe(0);
  });

  it("reports there is no rulebook rather than ranking the pairs of a project it never found", async () => {
    const { code, output } = await explainIn("/", ["--ungoverned"]);

    expect(code).toBe(3);
    expect(output).toBe("no trueup.config.ts found\n");
  });

  it("still refuses a flag it does not know when asked for the gaps", async () => {
    const { code, output } = await explainIn(UNRULED, ["--ungoverned", "--verbose"]);

    expect(code).toBe(EXIT_BAD_USAGE);
    expect(output).toContain("unrecognised: --verbose");
  });
});

const pairsIn = (said: string): string[] => {
  const lines = said.split("\n");
  const from = lines.findIndex((line) => line.startsWith("ungoverned "));
  return lines.slice(from + 1, lines.indexOf("", from));
};

describe("more pairs than the block will print", () => {
  const wide = () => gaps(fixtureAt("ungoverned-wide"));

  it("shows the first twenty in order and counts the rest, so the block stays readable", async () => {
    const pairs = pairsIn(await wide());

    expect(pairs[0]).toBe("    a → c  1");
    expect(pairs[19]).toBe("    e → d  1");
    expect(pairs[20]).toBe("    and 4 more");
  });

  it("counts only what it withheld, not the whole list over again", async () => {
    expect(pairsIn(await wide())).toHaveLength(21);
  });

  it("says none for a project where every zone is named by some rule", async () => {
    expect(await wide()).toContain("silent      none");
  });
});

describe("exactly as many pairs as the block will print", () => {
  const brim = () => gaps(fixtureAt("ungoverned-brim"));

  it("shows all of them, with nothing counted after", async () => {
    expect(pairsIn(await brim())).toHaveLength(20);
  });

  it("says nothing about more, since there are none", async () => {
    expect(await brim()).not.toContain("more");
  });
});
