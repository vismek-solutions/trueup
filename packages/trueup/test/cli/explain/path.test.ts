import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXIT_BAD_USAGE } from "../../../src/cli/command.ts";
import { runExplain } from "../../../src/cli/explain/run.ts";
import { EXPLAINED, explainIn, ISOLATED, saidBy } from "../../support/explain.ts";
import { fixtureAt } from "../../support/fixtures.ts";

const explain = (...argv: string[]) => explainIn(EXPLAINED, argv);

const isolated = async (path: string): Promise<string> => (await explainIn(ISOLATED, [path])).output;

describe("explaining a path a rule keeps apart from its siblings", () => {
  it("names the part it belongs to and the siblings it may not reach", async () => {
    expect(await isolated("apps/web/src/routes/a/page.ts")).toContain(
      "siblings    a, which `apps/web/src/routes/*` keeps apart from b",
    );
  });

  it("names the parts the group shares, since those it may still reach", async () => {
    expect(await isolated("apps/web/src/routes/a/page.ts")).toContain(
      "it may still reach shared, which the group shares",
    );
  });

  it("says a file at the parent sits beside the group rather than in one of its parts", async () => {
    const said = await isolated("apps/web/src/routes/stray.ts");

    expect(said.endsWith("siblings    sits beside `apps/web/src/routes/*` rather than in one of its parts\n")).toBe(
      true,
    );
  });

  it("says a file wiring covers assembles the group, so it reaches every part", async () => {
    expect(await isolated("apps/web/src/routes/index.ts")).toContain(
      "siblings    assembles `apps/web/src/routes/*`, so it may reach every part of it",
    );
  });

  it("stays silent about siblings for a path no isolation rule reaches", async () => {
    expect(await isolated("libs/kit/src/button.ts")).not.toContain("siblings");
  });
});

describe("explaining a shared directory that stands in an order", () => {
  const layered = async (path: string): Promise<string> =>
    (await explainIn(fixtureAt("shared-layers"), [path])).output;

  it("names the shared siblings it may still reach, and the ones held back from it", async () => {
    const said = await layered("src/routes/_root/mount.ts");

    expect(said).toContain("it may still reach _state, which the group shares");
    expect(said).toContain("it may not reach _ui, though the group shares it");
  });

  it("says only what is held back when it may reach none of them, and nothing more", async () => {
    expect(await layered("src/routes/_state/store.ts")).toBe(
      [
        "src/routes/_state/store.ts",
        "",
        "zone        app",
        "may reach   app",
        "may not     none",
        "",
        "siblings    _state, which `src/routes/*` keeps apart from a · b",
        "            it may not reach _root · _ui, though the group shares them",
        "",
      ].join("\n"),
    );
  });

  it("keeps an island reaching every shared directory, whatever the order among them", async () => {
    expect(await layered("src/routes/a/page.ts")).toBe(
      [
        "src/routes/a/page.ts",
        "",
        "zone        app",
        "may reach   app",
        "may not     none",
        "",
        "siblings    a, which `src/routes/*` keeps apart from b",
        "            it may still reach _root · _state · _ui, which the group shares",
        "",
      ].join("\n"),
    );
  });
});

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
    const { output } = await explain("src/loose.ts");

    expect(output).toBe(
      [
        "src/loose.ts",
        "",
        "zone        none",
        "            this path matches no zone, so writing here fails every-file-belongs-to-a-zone",
        "            put it under an existing zone, or declare one for it",
        "",
      ].join("\n"),
    );
  });

  it("names no check for a path outside the roots, since nothing there is analysed", async () => {
    const { output } = await explain("docs/notes.ts");

    expect(output).toBe(
      [
        "docs/notes.ts",
        "",
        "zone        none",
        "            this path is not analysed, so no claim applies to it",
        "            it sits outside the roots the analysis reads",
        "",
      ].join("\n"),
    );
  });

  it("says an extension the analysis never reads is not governed, whatever zone it falls in", async () => {
    const { output } = await explain("src/engine/theme.css");

    expect(output).toContain("zone        engine");
    expect(output).toContain("this path is not analysed, so no claim applies to it");
    expect(output).not.toContain("may reach");
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
    const { output } = await explain(join(EXPLAINED, "src/engine/notYetWritten.ts"));
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
  const wide = () => saidBy(fixtureAt("explained-wide"), "src/engine/x.ts");

  it("shows the first few in order and counts the rest, so the block stays readable", async () => {
    expect(await wide()).toContain("alpha · bravo · charlie · delta · echo · foxtrot · and 2 more");
  });

  it("counts the values it withheld the same way", async () => {
    expect(await wide()).toContain("eight · five · four · one · seven · six · and 2 more");
  });
});

describe("a vocabulary exactly as long as it will print", () => {
  const brim = () => saidBy(fixtureAt("explained-brim"), "src/engine/x.ts");

  it("shows all of it, with nothing counted after", async () => {
    expect(await brim()).toContain("alpha · bravo · charlie · delta · echo · foxtrot\n");
  });

  it("says nothing about more, since there are none", async () => {
    expect(await brim()).not.toContain("more");
  });
});

describe("a project that configured no rules of its own", () => {
  it("says nothing about what also runs, rather than an empty list", async () => {
    const output = await saidBy(fixtureAt("project"), "src/engine/x.ts");

    expect(output).toContain("zone        engine");
    expect(output).not.toContain("also runs");
  });
});
