import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXIT_BAD_USAGE } from "../../../src/cli/command.ts";
import { runExplain } from "../../../src/cli/explain/run.ts";
import { EXPLAINED, explainIn, ISOLATED, saidBy } from "../../support/explain.ts";
import { fixtureAt } from "../../support/fixtures.ts";

const explain = (...argv: string[]) => explainIn(EXPLAINED, argv);

const isolated = async (path: string): Promise<string> => (await explainIn(ISOLATED, [path])).output;

const lines = (...said: string[]): string => said.join("\n");

describe("explaining a path a rule keeps apart from its siblings", () => {
  it("keeps a part from every other part, naming the shared ones as the exception it may still reach", async () => {
    expect(await saidBy(fixtureAt("activated-switches"), "src/app/one.ts")).toContain(
      lines('<siblings group="src/*" part="app">', "<kept-apart-from>every other part of src/*</kept-apart-from>"),
    );
    expect(await isolated("apps/web/src/routes/a/page.ts")).toContain(
      lines(
        '<siblings group="apps/web/src/routes/*" part="a">',
        "<kept-apart-from>every other part of apps/web/src/routes/*, except the ones in may-reach-shared</kept-apart-from>",
        "<may-reach-shared>",
        "* shared",
        "</may-reach-shared>",
        "</siblings>",
      ),
    );
  });

  it("says a file at the parent sits beside the group rather than in one of its parts", async () => {
    expect(await isolated("apps/web/src/routes/stray.ts")).toContain(
      '<siblings group="apps/web/src/routes/*">sits beside the group rather than in one of its parts</siblings>',
    );
  });

  it("says a file wiring covers assembles the group, so it reaches every part", async () => {
    expect(await isolated("apps/web/src/routes/index.ts")).toContain(
      '<siblings group="apps/web/src/routes/*">assembles the group, so it may reach every part of it</siblings>',
    );
  });

  it("says none is kept apart when every other part is shared, and lists the shared parts", async () => {
    expect(await saidBy(fixtureAt("shared-only"), "src/routes/a/page.ts")).toContain(
      lines(
        '<siblings group="src/routes/*" part="a">',
        "<kept-apart-from>none</kept-apart-from>",
        "<may-reach-shared>",
        "* _state",
        "* _ui",
        "</may-reach-shared>",
        "</siblings>",
      ),
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
    expect(await layered("src/routes/_root/mount.ts")).toContain(
      lines("<may-reach-shared>", "* _state", "</may-reach-shared>", "<may-not-reach-shared>", "* _ui"),
    );
  });

  it("says only what is held back when it may reach none of them, and nothing more", async () => {
    const said = await layered("src/routes/_state/store.ts");

    expect(said).toContain(lines("<may-not-reach-shared>", "* _root", "* _ui", "</may-not-reach-shared>"));
    expect(said).not.toContain("<may-reach-shared>");
    expect(said).toContain("<kept-apart-from>every other part of src/routes/*</kept-apart-from>");
  });

  it("keeps an island reaching every shared directory, whatever the order among them", async () => {
    const said = await layered("src/routes/a/page.ts");

    expect(said).toContain(lines("<may-reach-shared>", "* _root", "* _state", "* _ui", "</may-reach-shared>"));
    expect(said).not.toContain("<may-not-reach-shared>");
  });
});

describe("explaining a path before writing it", () => {
  it("says the whole block for a file with a seam over it: its zone, what it may reach, and the vocabulary it may not use", async () => {
    expect((await explain("src/engine/notYetWritten.ts")).output).toBe(
      lines(
        "<answer>",
        "<paths>",
        "* src/engine/notYetWritten.ts",
        "</paths>",
        "<zone>engine</zone>",
        "<may-reach>",
        "* engine",
        "* shared",
        "</may-reach>",
        '<may-not-name owner="domain">',
        "* Warrant",
        "* WarrantKind",
        "* warrantKinds",
        "</may-not-name>",
        '<may-not-repeat owner="domain">',
        "* search",
        "* testimony",
        "</may-not-repeat>",
        "</answer>",
        "",
        "<also-runs>",
        "* a-named-custom-rule",
        "</also-runs>",
        "",
      ),
    );
  });

  it("names only the zones it may reach, never the ones it may not", async () => {
    expect((await explain("src/engine/notYetWritten.ts")).output).not.toContain("<may-not-reach>");
  });

  it("nests the zones it may reach by their path, keeping a zone that is also a group head unsplit", async () => {
    expect(await saidBy(fixtureAt("explained-tree"), "src/tools/new.ts")).toContain(
      lines("<may-reach>", "* app/ui", "* app", "* lib", "   * data", "   * net", "      * http", "* tools", "</may-reach>"),
    );
  });

  it("says nothing about vocabulary for a zone no seam rule covers", async () => {
    const { output } = await explain("src/shared/other.ts");
    expect(output).toContain("<zone>shared</zone>");
    expect(output).not.toContain("may-not-name");
  });

  it("warns that a path in no zone would fail the check, and says what to do about it", async () => {
    expect((await explain("src/loose.ts")).output).toBe(
      lines(
        "<answer>",
        "<paths>",
        "* src/loose.ts",
        "</paths>",
        "<zone>none</zone>",
        "<no-zone>",
        "this path matches no zone, so writing here fails every-file-belongs-to-a-zone",
        "put it under an existing zone, or declare one for it",
        "</no-zone>",
        "</answer>",
        "",
      ),
    );
  });

  it("names no check for a path outside the roots, since nothing there is analysed", async () => {
    expect((await explain("docs/notes.ts")).output).toContain(
      lines(
        "<zone>none</zone>",
        "<not-analysed>",
        "this path is not analysed, so no claim applies to it",
        "it sits outside the roots the analysis reads",
        "</not-analysed>",
      ),
    );
  });

  it("says an extension the analysis never reads is not governed, whatever zone it falls in", async () => {
    const { output } = await explain("src/engine/theme.css");

    expect(output).toContain("<zone>engine</zone>");
    expect(output).toContain("this path is not analysed, so no claim applies to it");
    expect(output).not.toContain("may-reach");
  });

  it("says a rulebook sits outside the analysis, rather than naming a check it cannot fail", async () => {
    expect((await explain("trueup.config.ts")).output).toContain(
      lines(
        "<zone>none</zone>",
        "<rulebook>",
        "this is a rulebook, so it sits outside the analysis it configures",
        "no zone, boundary or seam rule applies to it",
        "</rulebook>",
      ),
    );
  });

  it("answers for every path it is given, once for paths that share an answer, naming what also runs at the end", async () => {
    const { code, output } = await explain("src/shared/other.ts", "src/loose.ts", "src/shared/another.ts");

    expect(code).toBe(0);
    expect(output).toBe(
      lines(
        "<answer>",
        "<paths>",
        "* src/shared/other.ts",
        "* src/shared/another.ts",
        "</paths>",
        "<zone>shared</zone>",
        "<may-reach>",
        "* engine",
        "* domain",
        "* shared",
        "</may-reach>",
        "</answer>",
        "",
        "<answer>",
        "<paths>",
        "* src/loose.ts",
        "</paths>",
        "<zone>none</zone>",
        "<no-zone>",
        "this path matches no zone, so writing here fails every-file-belongs-to-a-zone",
        "put it under an existing zone, or declare one for it",
        "</no-zone>",
        "</answer>",
        "",
        "<also-runs>",
        "* a-named-custom-rule",
        "</also-runs>",
        "",
      ),
    );
  });

  it("keeps the names an existing domain file declares when it is explained beside a new file", async () => {
    expect((await explain("src/domain/warrant.ts", "src/engine/notYetWritten.ts")).output).toContain("* WarrantKind");
  });

  it("accepts an absolute path", async () => {
    const { output } = await explain(join(EXPLAINED, "src/engine/notYetWritten.ts"));
    expect(output).toContain("<zone>engine</zone>");
  });

  it("refuses a missing path as bad usage rather than as a missing rulebook", async () => {
    const { code, output } = await explain();
    expect(code).toBe(EXIT_BAD_USAGE);
    expect(output).toContain("usage");
  });

  it("names the path it is explaining, written relative to the project", async () => {
    expect((await explain("src/engine/notYetWritten.ts")).output).toContain(
      lines("<paths>", "* src/engine/notYetWritten.ts", "</paths>"),
    );
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
});

describe("a vocabulary too long to print", () => {
  const wide = () => saidBy(fixtureAt("explained-wide"), "src/engine/x.ts");

  it("shows the first few in order and counts the rest, for names and values alike", async () => {
    const said = await wide();

    expect(said).toContain(lines("* echo", "* foxtrot", "* and 2 more", "</may-not-name>"));
    expect(said).toContain(lines("* seven", "* six", "* and 2 more", "</may-not-repeat>"));
  });
});

describe("a vocabulary exactly as long as it will print", () => {
  it("shows all of it, with nothing counted after", async () => {
    const said = await saidBy(fixtureAt("explained-brim"), "src/engine/x.ts");

    expect(said).toContain(lines("* foxtrot", "</may-not-name>"));
    expect(said).not.toContain("more");
  });
});

describe("a project that configured no rules of its own", () => {
  it("says nothing about what also runs, rather than an empty list", async () => {
    const output = await saidBy(fixtureAt("project"), "src/engine/x.ts");

    expect(output).toContain("<zone>engine</zone>");
    expect(output).not.toContain("also-runs");
  });
});

describe("a rule a member defines", () => {
  const FEDERATED = fixtureAt("federated-extras");

  it("is named only beside a path inside that member, since it cannot see the rest", async () => {
    expect(await saidBy(FEDERATED, "packages/core/src/engine/run.ts")).not.toContain("also-runs");
    expect(await saidBy(FEDERATED, "packages/core/src/engine/run.ts", "packages/ui/src/view/chip.ts")).toContain(
      lines(
        "<also-runs>",
        "* ui/one-declaration-per-file",
        "* ui/sees-only-its-own-package",
        "* ui/reports-what-the-scope-lets-it-see",
        "</also-runs>",
      ),
    );
  });
});
