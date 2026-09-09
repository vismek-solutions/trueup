import { describe, expect, it } from "vitest";
import { CLAIMED, CUT, explainIn, saidBy, UNRULED } from "../../support/explain.ts";

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

  it("says whether the readers are spread, since that is what decides if a split has a home", async () => {
    expect(await about("src/tools/three.ts#hammer")).toContain("2 directories read it");
  });

  it("calls the directory holding the file a dot, so a reader beside it still reads as somewhere", async () => {
    const said = await cutting("lib.ts#label");

    expect(said).toContain("directories: . · nested");
    expect(said).toContain("2 directories read it");
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
      "nothing that stays reads what it reaches, so no one else has to agree",
    );
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

  it("leaves out a claim standing against another name in the same file", async () => {
    expect((await standing("lib/one.ts#label")).join()).not.toContain("declares badge");
  });

  it("counts what it gathered, so a list that grew silently would show", async () => {
    expect(await saidBy(CLAIMED, "lib/one.ts#label")).toContain("claims      2");
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

  it("leads with the file and the name, written relative to the project, then a blank line", async () => {
    expect((await saidBy(CLAIMED, "lib/one.ts#label")).split("\n").slice(0, 3)).toEqual([
      "lib/one.ts#label",
      "",
      "label",
    ]);
  });
});
