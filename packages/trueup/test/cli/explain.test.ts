import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { EXIT_BAD_USAGE } from "../../src/cli/command.ts";
import { runExplain } from "../../src/cli/explain.ts";

const PROJECT = fixtureAt("explained");

const explain = async (...argv: string[]): Promise<{ code: number; output: string }> => {
  let output = "";
  const code = await runExplain({ cwd: PROJECT, argv, write: (line) => (output += `${line}\n`) });
  return { code, output };
};

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

  it("warns that a path in no zone would fail the check", async () => {
    const { output } = await explain("docs/notes.ts");
    expect(output).toContain("zone        none");
    expect(output).toContain("every-file-belongs-to-a-zone");
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
