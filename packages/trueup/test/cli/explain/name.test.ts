import { describe, expect, it } from "vitest";
import { CLAIMED, CUT, explainIn, ISOLATED, saidBy, UNRULED } from "../../support/explain.ts";

const about = (target: string) => saidBy(UNRULED, target);

const cutting = (target: string) => saidBy(CUT, target);

const standing = async (target: string): Promise<string[]> =>
  (await saidBy(CLAIMED, target)).split("\n").filter((line) => /^ {4}\S/.test(line));

describe("who reads one export", () => {
  it("names every file that reads it, through the declaring file rather than the module named", async () => {
    expect(await about("src/tools/three.ts#hammer")).toContain(
      "read by     src/core/two.ts · src/web/one.ts",
    );
  });

  it("names the zones those readers sit in, since a move is a zone question", async () => {
    expect(await about("src/tools/three.ts#hammer")).toContain("zones: core · web");
  });

  it("marks a reader zone the claim does not count, beside the claim still naming one consumer", async () => {
    const said = await saidBy(CLAIMED, "lib/one.ts#label");

    expect(said).toContain("zones: app · lib · spec (tests)");
    expect(said).toContain("declares label, used only by app/reader.ts");
  });

  it("names the zone that keeps a reader it may not reach, rather than promising a move", async () => {
    const said = await saidBy(CLAIMED, "lib/one.ts#label");

    expect(said).toContain("lib keeps a reader of this and may not reach app · spec");
    expect(said).not.toContain("so a split has somewhere to land");
  });

  it("points at the guide when a role is in play, since the word alone does not say what it changes", async () => {
    expect(await saidBy(CLAIMED, "lib/one.ts#label")).toContain(
      "a role changes what a claim expects of a zone: trueup docs zones",
    );
  });

  it("stays quiet about roles when no reader zone carries one", async () => {
    expect(await about("src/tools/three.ts#hammer")).not.toContain("a role changes what a claim expects");
  });

  it("says whether the readers are spread, since that is what decides if a split has a home", async () => {
    expect(await about("src/tools/three.ts#hammer")).toContain(
      "2 directories beyond its own read it, so a split has somewhere to land",
    );
  });

  it("calls the directory holding the file a dot, so a reader beside it still reads as somewhere", async () => {
    const said = await cutting("lib.ts#label");

    expect(said).toContain("directories: . · nested");
  });

  it("does not count the directory it already lives in as somewhere a split could land", async () => {
    const said = await cutting("lib.ts#label");

    expect(said).toContain("every reader outside that directory sits in one, so a move has one target");
    expect(said).not.toContain("directories beyond its own read it");
  });

  it("says a move has nowhere to go when every reader sits beside it already", async () => {
    const said = await cutting("lib.ts#beside");

    expect(said).toContain("directories: .");
    expect(said).toContain("every reader sits in the directory it is declared in");
  });

  it("names the one directory rather than only counting it when the readers agree", async () => {
    expect(await cutting("twin.ts#label")).toContain("directories: nested");
  });

  it("keeps two files declaring one name apart, since the reader belongs to the declaring file", async () => {
    expect(await cutting("lib.ts#label")).toContain("read by     nested/deep.ts · reader.ts · stray.ts");
    expect(await cutting("twin.ts#label")).toContain("read by     nested/twin-reader.ts");
  });

  it("counts a reader no zone claims among the files but names no zone for it", async () => {
    const said = (await cutting("lib.ts#label")).split("\n");

    expect(said).toContain("read by     nested/deep.ts · reader.ts · stray.ts");
    expect(said).toContain("            zones: app");
  });

  it("says nothing about declaring elsewhere for a name this file does declare", async () => {
    expect(await cutting("lib.ts#label")).not.toContain("declared elsewhere");
  });

  it("says so when nothing reads the export, rather than printing an empty list", async () => {
    expect(await cutting("lib.ts#other")).toContain("read by     nothing in this project");
  });
});

describe("pricing what one export would cost to move", () => {
  it("counts nothing as travelling when the export reaches nothing else in its file", async () => {
    expect(await about("src/tools/three.ts#hammer")).toContain(
      "cut cost    0 declarations would travel with it · 0 would have to be promoted first · 0 imports would follow",
    );
  });

  it("follows the chain out of the export, not just what it names directly", async () => {
    expect(await cutting("lib.ts#label")).toContain("travels     clean · joinAll");
  });

  it("keeps back a helper something staying behind also reads, since that one must be promoted", async () => {
    const said = await cutting("lib.ts#label");

    expect(said).toContain("promote     trim");
    expect(said).toContain("cutting means promoting them first");
  });

  it("prices the whole cut in one line, with the numbers agreeing with the lists", async () => {
    expect(await cutting("lib.ts#label")).toContain(
      "cut cost    2 declarations would travel with it · 1 would have to be promoted first · 1 import would follow",
    );
  });

  it("counts an import as following only when a travelling declaration reaches it", async () => {
    expect(await cutting("lib.ts#label")).toContain("follows     node:path");
    expect(await cutting("lib.ts#other")).toContain("follows     none");
  });

  it("says nothing must be promoted when the export owns everything it reaches", async () => {
    const said = await cutting("lib.ts#bounce");

    expect(said).toContain("promote     none");
    expect(said).not.toContain("cutting means promoting them first");
  });

  it("says a bare promote count means nobody else has to agree, not that the move is free", async () => {
    expect(await cutting("lib.ts#bounce")).toContain(
      "nothing else in this file reads what it reaches, so no one else has to agree",
    );
  });

  it("names what stays behind and reads it, since that is what the move would break", async () => {
    const said = await cutting("lib.ts#seed");

    expect(said).toContain("import back decorate");
    expect(said).toContain("the cut is not free until they import it back");
  });

  it("counts a reader that stays in the price, so three zeroes cannot read as free", async () => {
    expect(await cutting("lib.ts#seed")).toContain(
      "cut cost    0 declarations would travel with it · 0 would have to be promoted first · 0 imports would follow · 1 here would import it back",
    );
  });

  it("finds a reader that stays even where nothing exported reaches it", async () => {
    expect(await cutting("lib.ts#seed")).not.toContain("import back none");
  });

  it("leaves out an import the declaration only sits above, rather than one it reaches", async () => {
    expect(await cutting("lib.ts#seed")).toContain("follows     none");
  });

  it("leaves out an import a declaration names in a string, which imports nothing", async () => {
    expect(await cutting("lib.ts#seed")).not.toContain("node:os");
  });

  it("says nothing needs it back when what stays never reads it", async () => {
    const said = await cutting("lib.ts#bounce");

    expect(said).toContain("import back none");
    expect(said).toContain("the file it leaves needs nothing back");
  });

  it("walks a cycle between two helpers once rather than forever", async () => {
    expect(await cutting("lib.ts#bounce")).toContain("travels     ping · pong");
  });

  it("names the import that would follow the export out of the file", async () => {
    const said = await about("src/core/two.ts#engine");

    expect(said).toContain("1 import would follow");
    expect(said).toContain("follows     ../tools/three.js");
  });

  it("refuses to price a re-export rather than reporting zeroes that would read as free", async () => {
    const said = await cutting("barrel.ts#label");

    expect(said).toContain("label  (exported here, declared elsewhere)");
    expect(said).toContain("cut cost    not priced here, since what would move is declared in another file");
    expect(said).not.toContain("travels");
    expect(said).not.toContain("promote");
  });
});

describe("what already stands against one export", () => {
  it("gathers a claim standing against the name, anchored where the violation is", async () => {
    expect(await about("src/tools/three.ts#hammer")).toContain(
      "every-import-respects-its-zone-boundary  src/web/one.ts  is web and may not reach tools: hammer",
    );
  });

  it("says none stand against a name nothing has flagged, rather than printing an empty list", async () => {
    expect(await about("src/tools/three.ts#wrench")).toContain("none stand against this name");
  });

  it("gathers a claim standing on the declaration itself, which no reader would name", async () => {
    expect(await standing("lib/one.ts#label")).toContain(
      "    no-declaration-is-written-twice  lib/one.ts  declares label, which is written the same way in lib/two.ts",
    );
  });

  it("leaves out the same claim against the same name declared in another file", async () => {
    expect((await standing("lib/one.ts#label")).join()).not.toContain("lib/two.ts  declares label");
  });

  it("gathers a placement claim, so explain cannot say nothing stands while the check reports it", async () => {
    expect(await standing("lib/one.ts#label")).toContain(
      "    no-value-is-declared-away-from-its-only-consumer  lib/one.ts  declares label, used only by app/reader.ts",
    );
  });

  it("leaves out a claim standing against another name in the same file", async () => {
    expect((await standing("lib/one.ts#label")).join()).not.toContain("declares badge");
  });

  it("gathers a claim about the whole file against each of the names it covers", async () => {
    const said = await standing("lib/three.ts#secondThing");

    expect(said).toContain(
      "    no-value-is-declared-away-from-its-only-consumer  lib/three.ts  declares 2 exports, all used only by app/reader.ts, so the file is in the wrong directory rather than the declarations",
    );
  });

  it("gathers a sibling breach, since an isolation rule refuses a name and not only a file", async () => {
    expect(await saidBy(ISOLATED, "apps/web/src/routes/b/thing.ts#thing")).toContain(
      "no-sibling-directory-reaches-another  apps/web/src/routes/a/page.ts  is a and may not reach sibling b",
    );
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

  it("reports there is no rulebook rather than pricing a name in a project it never found", async () => {
    const { code, output } = await explainIn("/", ["x.ts#label"]);

    expect(code).toBe(3);
    expect(output).toBe("no trueup.config.ts found\n");
  });

  it("says the whole block for a name, spacing and all", async () => {
    expect(await saidBy(CLAIMED, "lib/one.ts#label")).toBe(
      [
        "lib/one.ts#label",
        "",
        "label",
        "",
        "read by     app/reader.ts · lib/four.ts · spec/reads.ts",
        "            zones: app · lib · spec (tests)",
        "            a role changes what a claim expects of a zone: trueup docs zones",
        "            directories: app · lib · spec",
        "            lib keeps a reader of this and may not reach app · spec",
        "",
        "cut cost    0 declarations would travel with it · 0 would have to be promoted first · 0 imports would follow · 0 here would import it back",
        "travels     none",
        "promote     none",
        "            nothing else in this file reads what it reaches, so no one else has to agree",
        "follows     none",
        "import back none",
        "            nothing else in this file reads it, so the file it leaves needs nothing back",
        "",
        "claims      3",
        "    every-import-respects-its-zone-boundary  app/reader.ts  is app and may not reach lib: label from lib/one.ts",
        "    no-declaration-is-written-twice  lib/one.ts  declares label, which is written the same way in lib/two.ts",
        "    no-value-is-declared-away-from-its-only-consumer  lib/one.ts  declares label, used only by app/reader.ts",
        "            delegated tools are not consulted here; run the check itself for those",
        "",
      ].join("\n"),
    );
  });
});
