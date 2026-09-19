import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { readingText, reportForConfig } from "../support/report.ts";

const PROJECT = fixtureAt("guarded-strings");
const { messagesFor } = readingText(PROJECT, reportForConfig(join(PROJECT, "trueup.config.ts")));

describe("prose written into a string", () => {
  it("is held to the marks and the words, in a plain string and in one carrying a value", async () => {
    expect(await messagesFor("no-prose-uses-a-banned-mark", "src/said.ts")).toEqual([
      'uses "—" where a full stop, a comma, a colon or a joining word would do',
    ]);
    expect(await messagesFor("no-prose-uses-a-banned-word", "src/said.ts")).toEqual([
      'uses "leverage" where "use" would do',
      'uses "leverage" where "use" would do',
    ]);
  });

  it("keeps the blank line inside one whole string, so a paragraph ends where it is written", async () => {
    expect(await messagesFor("no-passage-runs-past-its-limit", "src/said.ts")).toEqual([
      "runs to 3 sentences, more than the 2 allowed",
    ]);
  });

  it("says a passage joined when the code runs cannot be read as the text it is", async () => {
    expect(await messagesFor("no-prose-is-assembled-from-parts", "src/said.ts")).toEqual([
      "builds a passage from parts, where one whole string would read as the text it is",
    ]);
  });
});
