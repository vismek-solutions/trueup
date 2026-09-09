import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { EXIT_BAD_USAGE } from "../../src/cli/command.ts";
import { runExplain } from "../../src/cli/explain/run.ts";

const PROJECT = fixtureAt("explained");
const UNRULED = fixtureAt("ungoverned");

const explainIn = async (
  cwd: string,
  argv: readonly string[],
): Promise<{ code: number; output: string }> => {
  let output = "";
  const code = await runExplain({ cwd, argv: [...argv], write: (line) => (output += `${line}\n`) });
  return { code, output };
};

const explain = (...argv: string[]) => explainIn(PROJECT, argv);

const gaps = async (cwd: string): Promise<string> => (await explainIn(cwd, ["--ungoverned"])).output;

const about = async (target: string): Promise<string> => (await explainIn(UNRULED, [target])).output;

describe("explaining a path before writing it", () => {
  it("names the zone a file that does not exist yet would fall into", async () => {
    const { output } = await explain("src/engine/notYetWritten.ts");
    expect(output).toContain("zone        engine");
  });

  it("says which zones it may and may not reach", async () => {
    const { output } = await explain("src/engine/notYetWritten.ts");
    expect(output).toContain("may reach   engine · shared");
    expect(output).toContain("may not     domain");
  });

  it("lists the vocabulary the domain owns, without being told the words", async () => {
    const { output } = await explain("src/engine/notYetWritten.ts");
    expect(output).toContain("Warrant · WarrantKind · warrantKinds");
    expect(output).toContain("search · testimony");
  });

  it("names the custom rules that also run", async () => {
    expect((await explain("src/engine/notYetWritten.ts")).output).toContain("a-named-custom-rule");
  });

  it("says nothing about vocabulary for a zone no seam rule covers", async () => {
    const { output } = await explain("src/shared/other.ts");
    expect(output).toContain("zone        shared");
    expect(output).not.toContain("vocabulary");
  });

  it("says the whole block for a file with a seam over it, spacing and all", async () => {
    const { output } = await explain("src/engine/notYetWritten.ts");

    expect(output).toBe(
      [
        "src/engine/notYetWritten.ts",
        "",
        "zone        engine",
        "may reach   engine · shared",
        "may not     domain",
        "",
        "vocabulary  domain owns names this file may not use:",
        "            Warrant · WarrantKind · warrantKinds",
        "            and values it may not repeat:",
        "            search · testimony",
        "",
        "also runs   a-named-custom-rule",
        "",
      ].join("\n"),
    );
  });

  it("warns that a path in no zone would fail the check, and says what to do about it", async () => {
    const { output } = await explain("docs/notes.ts");

    expect(output).toBe(
      [
        "docs/notes.ts",
        "",
        "zone        none",
        "            this path matches no zone, so writing here fails every-file-belongs-to-a-zone",
        "            put it under an existing zone, or declare one for it",
        "",
      ].join("\n"),
    );
  });

  it("says a rulebook sits outside the analysis, rather than naming a check it cannot fail", async () => {
    const { output } = await explain("trueup.config.ts");

    expect(output).toBe(
      [
        "trueup.config.ts",
        "",
        "zone        none",
        "            this is a rulebook, so it sits outside the analysis it configures",
        "            no zone, boundary or seam rule applies to it",
        "",
      ].join("\n"),
    );
  });

  it("accepts an absolute path", async () => {
    const { output } = await explain(join(PROJECT, "src/engine/notYetWritten.ts"));
    expect(output).toContain("zone        engine");
  });

  it("asks for a path when given none", async () => {
    const { code, output } = await explain();
    expect(code).toBe(3);
    expect(output).toContain("usage");
  });

  it("leads with the path it is explaining, written relative to the project", async () => {
    const { output } = await explain("src/engine/notYetWritten.ts");

    expect(output.split("\n")[0]).toBe("src/engine/notYetWritten.ts");
  });

  it("refuses a flag rather than reading it as a path", async () => {
    const { code, output } = await explain("--verbose", "src/engine/x.ts");

    expect(code).toBe(EXIT_BAD_USAGE);
    expect(output).toContain("unrecognised: --verbose");
    expect(output).toContain("usage: trueup explain <path>");
  });

  it("names every flag it refused, spaced apart rather than run together", async () => {
    expect((await explain("--verbose", "--deep")).output).toContain("unrecognised: --verbose --deep");
  });

  it("reports when there is no rulebook, rather than reading the failure as a project", async () => {
    let output = "";
    const code = await runExplain({ cwd: "/", argv: ["x.ts"], write: (line) => (output += `${line}\n`) });

    expect(code).toBe(3);
    expect(output).toBe("no trueup.config.ts found\n");
  });

  it("says none where a zone is held back from nothing, rather than leaving the line blank", async () => {
    expect((await explain("src/domain/x.ts")).output).toContain("may not     none");
  });
});

describe("a vocabulary too long to print", () => {
  const wide = async (): Promise<string> => {
    let output = "";
    await runExplain({
      cwd: fixtureAt("explained-wide"),
      argv: ["src/engine/x.ts"],
      write: (line) => (output += `${line}\n`),
    });
    return output;
  };

  it("shows the first few in order and counts the rest, so the block stays readable", async () => {
    expect(await wide()).toContain("alpha · bravo · charlie · delta · echo · foxtrot · and 2 more");
  });

  it("counts the values it withheld the same way", async () => {
    expect(await wide()).toContain("eight · five · four · one · seven · six · and 2 more");
  });
});

describe("a vocabulary exactly as long as it will print", () => {
  const brim = async (): Promise<string> => {
    let output = "";
    await runExplain({
      cwd: fixtureAt("explained-brim"),
      argv: ["src/engine/x.ts"],
      write: (line) => (output += `${line}\n`),
    });
    return output;
  };

  it("shows all of it, with nothing counted after", async () => {
    expect(await brim()).toContain("alpha · bravo · charlie · delta · echo · foxtrot\n");
  });

  it("says nothing about more, since there are none", async () => {
    expect(await brim()).not.toContain("more");
  });
});

describe("a project that configured no rules of its own", () => {
  it("says nothing about what also runs, rather than an empty list", async () => {
    let output = "";
    await runExplain({
      cwd: fixtureAt("project"),
      argv: ["src/engine/x.ts"],
      write: (line) => (output += `${line}\n`),
    });

    expect(output).toContain("zone        engine");
    expect(output).not.toContain("also runs");
  });
});

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
    expect(await gaps(UNRULED)).not.toContain("core → \n");
    expect((await gaps(UNRULED)).split("\n").filter((line) => line.startsWith("    core →"))).toEqual([
      "    core → tools     2",
    ]);
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
    const said = await gaps(PROJECT);

    expect(said).toContain("ungoverned  none");
    expect(said.split("\n")).toContain("    domain");
  });

  it("says so plainly rather than printing an empty column when a section is bare", async () => {
    expect(await gaps(PROJECT)).toContain("allowed     none");
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

describe("pricing what one export would cost to move", () => {
  it("names every file that reads it, through the declaring file rather than the module named", async () => {
    expect(await about("src/tools/three.ts#hammer")).toContain(
      "read by     src/core/two.ts · src/web/one.ts",
    );
  });

  it("names the zones those readers sit in, since a move is a zone question", async () => {
    expect(await about("src/tools/three.ts#hammer")).toContain("zones: core · web");
  });

  it("says whether the readers are spread, since that is what decides if a split has a home", async () => {
    expect(await about("src/tools/three.ts#hammer")).toContain("2 directories read it");
  });

  it("counts nothing as travelling when the export reaches nothing else in its file", async () => {
    expect(await about("src/tools/three.ts#hammer")).toContain(
      "cut cost    0 declarations travel with it · 0 must be promoted first · 0 imports follow",
    );
  });

  it("names the import that would follow the export out of the file", async () => {
    const said = await about("src/core/two.ts#engine");

    expect(said).toContain("1 import follow");
    expect(said).toContain("follows     ../tools/three.js");
  });

  it("gathers a claim standing against the name, anchored where the violation is", async () => {
    expect(await about("src/tools/three.ts#hammer")).toContain(
      "every-import-respects-its-zone-boundary  src/web/one.ts  is web and may not reach tools: hammer",
    );
  });

  it("leaves out a claim standing against some other name in the same file", async () => {
    expect(await about("src/tools/three.ts#wrench")).toContain("none stand against this name");
  });

  it("says the delegated tools were not consulted, rather than implying it gathered everything", async () => {
    expect(await about("src/tools/three.ts#hammer")).toContain("delegated tools are not consulted");
  });

  it("says so plainly when the name is in neither the declarations nor the exports", async () => {
    expect(await about("src/core/two.ts#absent")).toContain("absent is neither declared nor exported here");
  });

  it("reports a clean run, since pricing a move is a question and not a failure", async () => {
    expect((await explainIn(UNRULED, ["src/tools/three.ts#hammer"])).code).toBe(0);
  });
});
