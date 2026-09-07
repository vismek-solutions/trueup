import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runExplain } from "../src/cli/explain.ts";

const PROJECT = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "explained");

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

  it("accepts an absolute path", async () => {
    const { output } = await explain(join(PROJECT, "src/engine/notYetWritten.ts"));
    expect(output).toContain("zone        engine");
  });

  it("asks for a path when given none", async () => {
    const { code, output } = await explain();
    expect(code).toBe(3);
    expect(output).toContain("usage");
  });
});
