import { describe, expect, it } from "vitest";
import { EXIT_BAD_USAGE } from "../../../src/cli/command.ts";
import { EXPLAINED, explainIn, saidBy, UNRULED } from "../../support/explain.ts";
import { fixtureAt } from "../../support/fixtures.ts";

const gaps = (cwd: string) => saidBy(cwd, "--ungoverned");

const itemsIn = async (cwd: string, tag: string): Promise<string[]> => {
  const said = (await gaps(cwd)).split("\n");
  return said.slice(said.indexOf(`<${tag}>`) + 1, said.indexOf(`</${tag}>`)).filter((line) => line.startsWith("* "));
};

describe("finding the boundaries nobody wrote", () => {
  it("ranks the pairs no rule speaks about, heaviest first, settling two pairs from one zone by where they reach", async () => {
    expect(await itemsIn(UNRULED, "ungoverned")).toEqual([
      "* loose → core, 3 edges",
      "* core → tools, 2 edges",
      "* extra → core, 1 edge",
      "* extra → tools, 1 edge",
    ]);
  });

  it("sorts what a rule permits too, so neither list drifts run to run", async () => {
    expect(await itemsIn(UNRULED, "allowed")).toEqual(["* aardvark → core, 1 edge", "* web → core, 1 edge"]);
  });

  it("says what each list means after the pairs it holds", async () => {
    const said = await gaps(UNRULED);

    expect(said).toContain("* extra → tools, 1 edge\nno rule speaks about these pairs\n</ungoverned>");
    expect(said).toContain("* web → core, 1 edge\na rule permits these, so someone decided\n</allowed>");
  });

  it("counts nothing for a zone reaching itself, which every zone may always do", async () => {
    expect(await gaps(UNRULED)).not.toContain("core → core");
  });

  it("counts nothing for an edge leaving a file no zone claims, nor for a reach into something no zone declares", async () => {
    const said = (await gaps(UNRULED)).split("\n");

    expect(said.filter((line) => line.includes("→ core"))).toEqual([
      "* loose → core, 3 edges",
      "* extra → core, 1 edge",
      "* aardvark → core, 1 edge",
      "* web → core, 1 edge",
    ]);
    expect(said.filter((line) => line.startsWith("* core →"))).toEqual(["* core → tools, 2 edges"]);
  });

  it("leaves out a pair a rule already refuses, since that is a violation and not a gap", async () => {
    expect(await gaps(UNRULED)).not.toContain("web → tools");
  });

  it("counts a pair as ungoverned when the rule naming that zone judges only other zones", async () => {
    expect(await itemsIn(UNRULED, "ungoverned")).toContain("* loose → core, 3 edges");
  });

  it("names every zone no boundary rule mentions, and only those", async () => {
    expect(await itemsIn(UNRULED, "silent")).toEqual(["* core", "* tools", "* extra"]);
  });

  it("says the whole block for a project where every claim holds, tags and all", async () => {
    expect(await gaps(EXPLAINED)).toBe(
      [
        "<about>",
        "Every pair below carries traffic that no boundary rule refuses, so none of it is a violation.",
        "A heavy pair is either the architecture nobody wrote down or a hole nobody noticed, and only",
        "reading it tells you which. Counted by the zone that declares the symbol, not the module named.",
        "</about>",
        "",
        "<ungoverned>none</ungoverned>",
        "",
        "<allowed>none</allowed>",
        "",
        "<silent>",
        "* domain",
        "* shared",
        "no boundary rule starts from these, so they may reach anything",
        "</silent>",
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

describe("more pairs than the block will print", () => {
  const wide = fixtureAt("ungoverned-wide");

  it("shows the first twenty in order and counts only what it withheld", async () => {
    const pairs = await itemsIn(wide, "ungoverned");

    expect(pairs[0]).toBe("* a → c, 1 edge");
    expect(pairs[19]).toBe("* e → d, 1 edge");
    expect(pairs[20]).toBe("* and 4 more");
    expect(pairs).toHaveLength(21);
  });

  it("says none for a project where every zone is named by some rule", async () => {
    expect(await gaps(wide)).toContain("<silent>none</silent>");
  });
});

describe("exactly as many pairs as the block will print", () => {
  const brim = fixtureAt("ungoverned-brim");

  it("shows all of them, with nothing counted after", async () => {
    expect(await itemsIn(brim, "ungoverned")).toHaveLength(20);
    expect(await gaps(brim)).not.toContain("more");
  });
});
