import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { explainIn } from "../support/explain.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { guardFor, verdictFrom } from "../support/guard.ts";
import { messagesFor } from "../support/report.ts";

const PROJECT = fixtureAt("guarded-assets");
const CLAIM = "no-stylesheet-forces-a-declaration";
const verdictOn = verdictFrom(PROJECT);

const FORCED = ".card {\n  display: flex !important;\n}\n";
const PLAIN = ".card {\n  display: block;\n}\n";

describe("a rule that reads a stylesheet", () => {
  it("refuses a write that puts into it what the rule forbids", async () => {
    expect(await verdictOn("src/card.css", FORCED)).toBe("deny");
  });

  it("allows a write that leaves it clean", async () => {
    expect(await verdictOn("src/card.css", PLAIN)).toBe("allowed");
  });

  it("judges a stylesheet that does not exist yet", async () => {
    expect(await verdictOn("src/badge.css", FORCED)).toBe("deny");
  });

  it("reads the edit being proposed rather than the copy on disk", async () => {
    expect(await messagesFor(join(PROJECT, "trueup.config.ts"), CLAIM)).toBe("");
    expect(await verdictOn("src/card.css", FORCED)).toBe("deny");
  });

  it("says nothing about a stylesheet falling in no zone, since no zone can hold one", async () => {
    const { output } = await guardFor(PROJECT)({
      tool_name: "Write",
      tool_input: { file_path: join(PROJECT, "src/card.css"), content: PLAIN },
    });

    expect(output).not.toContain("matches no zone");
  });
});

describe("explaining a stylesheet before writing it", () => {
  const said = async (path: string): Promise<string> => (await explainIn(PROJECT, [path])).output;

  it("says it is read as text rather than sending the reader to find it a zone", async () => {
    const output = await said("src/card.css");

    expect(output).toContain("this is an asset, so it is read as text and never parsed");
    expect(output).not.toContain("put it under an existing zone");
    expect(output).not.toContain("is not one of them");
  });

  it("still says a source file in no zone needs one", async () => {
    expect(await said("src/loose.txt")).toContain("is not one of them");
  });
});
