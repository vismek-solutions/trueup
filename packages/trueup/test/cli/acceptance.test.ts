import { describe, expect, it } from "vitest";
import { renderAcceptance } from "../../src/cli/acceptance.ts";

const ALPHA = "a-claim-whose-name-runs-past-the-default-column";
const BETA = "b-claim-whose-name-runs-past-the-default-column";
const FILE = "trueup.baseline.json";

const ADDED = [
  { claim: ALPHA, file: "src/a.ts", message: "first" },
  { claim: ALPHA, file: null, message: "second" },
  { claim: BETA, file: "src/b.ts", message: "third" },
];

describe("what an accepted baseline reports", () => {
  it("names every entry it added, under the claim that reported it", () => {
    expect(renderAcceptance({ total: 5, path: FILE, added: ADDED, first: false })).toBe(
      [
        `accepted 5 findings into ${FILE} · 3 new`,
        "",
        `${ALPHA}  2 new`,
        "    src/a.ts  first",
        "    second",
        `${BETA}  1 new`,
        "    src/b.ts  third",
      ].join("\n"),
    );
  });

  it("counts a first baseline per claim without listing it, since none of that list is growth", () => {
    expect(renderAcceptance({ total: 3, path: FILE, added: ADDED, first: true })).toBe(
      [
        `accepted 3 findings into ${FILE} · the first baseline`,
        "",
        `${ALPHA}  2 new`,
        `${BETA}  1 new`,
      ].join("\n"),
    );
  });

  it("says so in one line when nothing it accepted is new", () => {
    expect(renderAcceptance({ total: 5, path: FILE, added: [], first: false })).toBe(
      `accepted 5 findings into ${FILE} · nothing new`,
    );
  });

  it("counts a single finding without a plural, so the line reads as a sentence", () => {
    expect(renderAcceptance({ total: 1, path: FILE, added: [], first: false })).toContain(
      "accepted 1 finding into",
    );
  });
});
