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

  it("says nothing about a mark inside frontmatter or inline code", async () => {
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
});

describe("a passage past the length the project set", () => {
  const CLAIM = "no-passage-runs-past-its-limit";

  it("counts the words in a sentence and the sentences in a paragraph", async () => {
    expect(await messagesFor(CLAIM, "docs/loose.md")).toEqual([
      "runs to 16 words in one sentence, more than the 12 allowed",
      "runs to 3 sentences, more than the 2 allowed",
      "runs to 14 words in one sentence, more than the 12 allowed",
    ]);
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

  it("leaves a link inside inline code, a fenced block and an image alone", async () => {
    expect(await foundIn(CLAIM, "docs/links.md")).toHaveLength(1);
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
