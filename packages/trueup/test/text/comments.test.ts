import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { check } from "../../src/main.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { claimIn, readingText, reportForConfig } from "../support/report.ts";

const PROJECT = fixtureAt("guarded-comments");
const { foundIn, messagesFor } = readingText(PROJECT, reportForConfig(join(PROJECT, "trueup.config.ts")));

describe("a comment in a code file", () => {
  it("is held to the marks, the words and the limits the prose is held to", async () => {
    expect(await messagesFor("no-prose-uses-a-banned-mark", "src/loose.ts")).toEqual([
      'uses "—" where a full stop, a comma, a colon or a joining word would do',
    ]);
    expect(await messagesFor("no-prose-uses-a-banned-word", "src/loose.ts")).toEqual([
      'uses "leverage" where "use" would do',
    ]);
    expect(await messagesFor("no-passage-runs-past-its-limit", "src/loose.ts")).toEqual([
      "runs to 16 words in one sentence, more than the 12 allowed",
    ]);
  });

  it("names the word's own position, not the marker opening the comment", async () => {
    const source = await readFile(join(PROJECT, "src/loose.ts"), "utf8");
    const [found] = await foundIn("no-prose-uses-a-banned-word", "src/loose.ts");

    expect(found?.start).toBe(source.indexOf("leverage"));
  });

  it("says nothing about a marker standing inside a string, since a parser reads the file", async () => {
    expect(await messagesFor("no-prose-uses-a-banned-mark", "src/clean.ts")).toEqual([]);
    expect(await messagesFor("no-prose-uses-a-banned-word", "src/clean.ts")).toEqual([]);
    expect(await messagesFor("no-passage-runs-past-its-limit", "src/clean.ts")).toEqual([]);
  });

  it("is left alone by a rulebook that does not ask for it", async () => {
    const report = await check({
      root: PROJECT,
      roots: [join(PROJECT, "src")],
      zones: [{ name: "src", patterns: ["src/**"] }],
      text: { files: ["docs/**/*.md"], words: [{ word: "leverage", instead: "use" }] },
    });

    expect(claimIn(report, "no-prose-uses-a-banned-word")?.findings).toEqual([]);
  });
});
