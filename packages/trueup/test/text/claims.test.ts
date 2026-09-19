import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { check } from "../../src/main.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { claimIn, findingsIn, reportForConfig } from "../support/report.ts";

const PROJECT = fixtureAt("guarded-text");
const CONFIG = join(PROJECT, "trueup.config.ts");
const reported = reportForConfig(CONFIG);

const foundIn = async (claim: string, file: string) =>
  findingsIn(await reported, claim).filter((finding) => finding.file === join(PROJECT, file));

const messagesFor = async (claim: string, file: string): Promise<readonly string[]> =>
  (await foundIn(claim, file)).map((finding) => finding.message);

describe("a mark the project banned", () => {
  const CLAIM = "no-prose-uses-a-banned-mark";

  it("names the mark and what belongs in its place", async () => {
    expect(await messagesFor(CLAIM, "docs/loose.md")).toEqual([
      'uses "—" where a full stop, a comma, a colon or a joining word would do',
    ]);
  });

  it("says nothing about a mark inside a fenced block or a table", async () => {
    expect(await messagesFor(CLAIM, "docs/clean.md")).toEqual([]);
  });

  it("says nothing about a mark in frontmatter, inline code, a command line option or any line of an html comment", async () => {
    expect(await messagesFor(CLAIM, "docs/shapes.md")).toEqual([]);
  });
});

describe("a word the project banned", () => {
  const CLAIM = "no-prose-uses-a-banned-word";

  it("names the word as written and the one that replaces it", async () => {
    expect(await messagesFor(CLAIM, "docs/loose.md")).toEqual([
      'uses "Leverage" where "use" would do',
    ]);
  });

  it("says nothing about the word inside a fenced block", async () => {
    expect(await messagesFor(CLAIM, "docs/clean.md")).toEqual([]);
  });

  it("says nothing about the word on the line that closes an html comment", async () => {
    expect(await messagesFor(CLAIM, "docs/shapes.md")).toEqual([]);
  });

  it("reads on past a comment marker that stands in inline code, rather than going quiet", async () => {
    expect(await messagesFor(CLAIM, "docs/comments.md")).toEqual([
      'uses "Leverage" where "use" would do',
    ]);
  });
});

describe("a passage past the length the project set", () => {
  const CLAIM = "no-passage-runs-past-its-limit";

  it("counts the words in a sentence and the sentences in a paragraph", async () => {
    expect(await messagesFor(CLAIM, "docs/loose.md")).toEqual([
      "runs to 16 words in one sentence, more than the 12 allowed",
      "runs to 3 sentences, more than the 2 allowed",
      "runs to 14 words in one sentence, more than the 12 allowed",
      "runs to 18 words in one sentence, more than the 12 allowed",
    ]);
  });

  it("reads a list item and the lines wrapping under it as one passage", async () => {
    const source = await readFile(join(PROJECT, "docs/loose.md"), "utf8");
    const wrapped = (await foundIn(CLAIM, "docs/loose.md")).at(-1);

    expect(wrapped?.start).toBe(source.indexOf("__name__"));
  });

  it("reads a boundary the same whatever stands at it: inline code, a url, an underline", async () => {
    expect(await messagesFor(CLAIM, "docs/edges.md")).toEqual([]);
  });

  it("points at the sentence rather than at the paragraph holding it", async () => {
    const [, paragraph, sentence] = await foundIn(CLAIM, "docs/loose.md");

    expect(sentence?.start).toBeGreaterThan(paragraph?.start ?? 0);
  });
});

describe("a phrase standing in inline code", () => {
  const CLAIM = "no-inline-code-holds-more-than-a-path";

  it("says what inline code is for", async () => {
    expect(await messagesFor(CLAIM, "docs/loose.md")).toEqual([
      "holds a phrase in inline code, where a path, a command or a symbol belongs",
    ]);
  });

  it("leaves a path and a command carrying a flag alone", async () => {
    expect(await messagesFor(CLAIM, "docs/shapes.md")).toEqual([]);
  });
});

describe("a link whose text says nothing", () => {
  const CLAIM = "every-link-says-where-it-goes";

  it("quotes the text that stands in for the destination", async () => {
    expect(await messagesFor(CLAIM, "docs/links.md")).toEqual([
      'links as "this page", which says nothing about where it goes',
    ]);
  });

  it("leaves inline code, a fenced block, an image and a link named in code alone", async () => {
    expect(await foundIn(CLAIM, "docs/links.md")).toHaveLength(1);
  });
});

describe("a section that explains at length with nothing to look at", () => {
  const CLAIM = "every-long-section-shows-an-example";

  it("counts what the section spends and leaves a block, a list and a table alone", async () => {
    expect(await messagesFor(CLAIM, "docs/sections.md")).toEqual([
      "runs to 30 words with nothing to look at, more than the 20 allowed",
    ]);
  });

  it("warns rather than fails, since a section with nothing to show is allowed to say so", async () => {
    expect((await foundIn(CLAIM, "docs/sections.md")).map((finding) => finding.severity)).toEqual([
      "warning",
    ]);
  });
});

describe("a text setting the rulebook leaves out", () => {
  it("makes no claim at all, rather than one that passes", async () => {
    const report = await check({
      root: PROJECT,
      roots: [join(PROJECT, "src"), join(PROJECT, "docs")],
      zones: [{ name: "src", patterns: ["src/**"] }],
      assets: ["docs/**/*.md"],
      text: { files: ["docs/**/*.md"] },
    });

    expect(claimIn(report, "no-prose-uses-a-banned-mark")).toBeUndefined();
    expect(claimIn(report, "no-passage-runs-past-its-limit")).toBeUndefined();
  });
});
