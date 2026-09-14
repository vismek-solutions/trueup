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

const RETIRED = [{ claim: BETA, file: "src/gone.ts", message: "fixed long ago" }];

describe("what an accepted baseline reports", () => {
  it("names every entry it added, under the claim that reported it", () => {
    expect(renderAcceptance({ total: 5, path: FILE, added: ADDED, retired: [], first: false })).toBe(
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
    expect(renderAcceptance({ total: 3, path: FILE, added: ADDED, retired: [], first: true })).toBe(
      [
        `accepted 3 findings into ${FILE} · the first baseline`,
        "",
        `${ALPHA}  2 new`,
        `${BETA}  1 new`,
      ].join("\n"),
    );
  });

  it("counts what it dropped beside what it took, so a shrinking list is not silent", () => {
    expect(renderAcceptance({ total: 5, path: FILE, added: ADDED, retired: RETIRED, first: false })).toBe(
      [
        `accepted 5 findings into ${FILE} · 3 new · 1 retired`,
        "",
        `${ALPHA}  2 new`,
        "    src/a.ts  first",
        "    second",
        `${BETA}  1 new`,
        "    src/b.ts  third",
        `${BETA}  1 retired`,
      ].join("\n"),
    );
  });

  it("reports a run that only dropped entries, rather than calling it nothing new", () => {
    expect(renderAcceptance({ total: 4, path: FILE, added: [], retired: RETIRED, first: false })).toBe(
      [`accepted 4 findings into ${FILE} · 1 retired`, "", `${BETA}  1 retired`].join("\n"),
    );
  });

  it("says so in one line when the list it accepted is the one it held", () => {
    expect(renderAcceptance({ total: 5, path: FILE, added: [], retired: [], first: false })).toBe(
      `accepted 5 findings into ${FILE} · nothing changed`,
    );
  });

  it("counts a single finding without a plural, so the line reads as a sentence", () => {
    expect(
      renderAcceptance({ total: 1, path: FILE, added: [], retired: [], first: false }),
    ).toContain("accepted 1 finding into");
  });
});
