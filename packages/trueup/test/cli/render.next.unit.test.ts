import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderNext } from "../../src/cli/render.ts";
import type { Finding, Report } from "../../src/report/model.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { COPIES, error, kept, MIXED, reportOf, warning } from "../support/sample-report.ts";

const boundaryClaim = (findings: readonly Finding[]): Report["claims"][number] => ({
  claim: "every-import-respects-its-zone-boundary",
  guidance: "Move the code to a zone that may reach the target.",
  findings,
});

const STALE_ENTRY: Report["claims"][number] = {
  claim: "every-baseline-entry-is-still-needed",
  guidance: "Run it again with --update-baseline to drop them.",
  findings: [warning("a-claim no longer reports this: a violation fixed long ago", null)],
};

const ACCEPTED = reportOf([boundaryClaim([kept("is app and may not reach domain", "/p/d.ts")]), STALE_ENTRY]);

const STILL_FAILING = reportOf([
  {
    claim: "no-declaration-is-written-twice",
    guidance: "Keep one, put it where every caller may reach it, and delete the rest.",
    findings: [error("declares posix, written the same way elsewhere", "/p/a.ts")],
  },
  boundaryClaim([kept("is app and may not reach domain", "/p/d.ts")]),
]);

describe("the next report, to the character", () => {
  it("writes exactly this, showing the errors and leaving the warnings alone", () => {
    expect(renderNext(MIXED, "/p")).toBe(
      [
        "problem 1 of 1 · 3 claims · 1 error · 2 warnings",
        "",
        "a-mixed-claim  1 error",
        "    a.ts  an error here",
        "    alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar",
        "    papa quebec romeo",
      ].join("\n"),
    );
  });

  it("offers what the baseline accepted once nothing is failing, rather than stopping there", () => {
    expect(renderNext(ACCEPTED, "/p", { ratchet: { known: 1, stale: 0 } })).toBe(
      [
        "nothing failing · 2 claims · 0 errors · 2 warnings",
        "baseline  1 of 1 accepted",
        "",
        "every-import-respects-its-zone-boundary  1 accepted",
        "    d.ts  is app and may not reach domain",
        "    Move the code to a zone that may reach the target.",
        "    Fixing this one also needs `trueup --update-baseline` to drop its entry.",
      ].join("\n"),
    );
  });

  it("names the command the project runs it by, not the one this tool is called by default", () => {
    expect(renderNext(ACCEPTED, "/p", { command: "pnpm arch" })).toContain("`pnpm arch --update-baseline`");
  });

  it("leaves a stale entry out of what it offers, since that is not a violation to fix", () => {
    expect(renderNext(ACCEPTED, "/p")).not.toContain("no longer reports this");
  });

  it("counts the stale entries beside the accepted one, since both are baseline work", () => {
    expect(renderNext(ACCEPTED, "/p", { ratchet: { known: 1, stale: 2 } })).toContain(
      "baseline  1 of 1 accepted · 2 stale",
    );
  });

  it("offers an error that names no file, so a claim about the run itself is not skipped", () => {
    const nowhere = reportOf([
      { claim: "the-analysis-reached-files", guidance: "g", findings: [error("no files", null)] },
    ]);

    expect(renderNext(nowhere, "/p")).toBe(
      [
        "problem 1 of 1 · 1 claim · 1 error · 0 warnings",
        "",
        "the-analysis-reached-files  1 error",
        "    no files",
        "    g",
      ].join("\n"),
    );
  });

  it("offers what one claim accepted while another still fails, when asked for that claim", () => {
    const shown = renderNext(STILL_FAILING, "/p", { only: "boundary" });

    expect(shown).toContain("nothing failing in `boundary`");
    expect(shown).toContain("is app and may not reach domain");
  });

  it("still leads with a live error over anything the baseline accepted", () => {
    expect(renderNext(STILL_FAILING, "/p")).toContain("problem 1 of 1 · ");
  });

  it("names only the stale count when there is nothing left, since known is not a task", () => {
    expect(renderNext(reportOf([]), "/p", { ratchet: { known: 2, stale: 3 } })).toBe(
      "nothing left to fix · 0 claims · 0 errors · 0 warnings\nbaseline  3 stale",
    );
  });

  it("stays silent about a baseline with nothing stale in it", () => {
    expect(renderNext(reportOf([]), "/p", { ratchet: { known: 2, stale: 0 } })).toBe(
      "nothing left to fix · 0 claims · 0 errors · 0 warnings",
    );
  });

  it("names the file without a position when the offset cannot be placed in it", () => {
    const missing = reportOf([
      {
        claim: "c",
        guidance: "g",
        findings: [{ severity: "error", message: "m", file: "/p/gone.ts", start: 5 }],
      },
    ]);

    expect(renderNext(missing, "/p")).toContain("    gone.ts  m");
  });

  it("gives a finding with no offset no position, even where the file could be read", () => {
    const root = fixtureAt("routes");
    const whole = reportOf([
      {
        claim: "c",
        guidance: "g",
        findings: [
          { severity: "error", message: "m", file: join(root, "src/routes/b/thing.ts"), start: null },
        ],
      },
    ]);

    expect(renderNext(whole, root)).toContain("    src/routes/b/thing.ts  m");
  });

  it("turns an offset into a line and column against the file it names", () => {
    const root = fixtureAt("routes");
    const positioned = reportOf([
      {
        claim: "a-placed-claim",
        guidance: "g",
        findings: [
          { severity: "error", message: "here", file: join(root, "src/routes/b/thing.ts"), start: 7 },
        ],
      },
    ]);

    expect(renderNext(positioned, root)).toBe(
      [
        "problem 1 of 1 · 1 claim · 1 error · 0 warnings",
        "",
        "a-placed-claim  1 error",
        "    src/routes/b/thing.ts:1:8  here",
        "    g",
      ].join("\n"),
    );
  });
});

const guidanceOf = (guidance: string): Report =>
  reportOf([{ claim: "c", guidance, findings: [error("m", "/p/a.ts")] }]);

const wrapped = (guidance: string): string[] =>
  renderNext(guidanceOf(guidance), "/p")
    .split("\n")
    .filter((line) => line.startsWith("    "));

describe("wrapping the guidance", () => {
  it("keeps a line that lands exactly on the width", () => {
    expect(wrapped(`${"a".repeat(50)} ${"b".repeat(45)}`)).toEqual([
      "    a.ts  m",
      `    ${"a".repeat(50)} ${"b".repeat(45)}`,
    ]);
  });

  it("breaks the line that would pass the width by one", () => {
    expect(wrapped(`${"a".repeat(50)} ${"b".repeat(46)}`)).toEqual([
      "    a.ts  m",
      `    ${"a".repeat(50)}`,
      `    ${"b".repeat(46)}`,
    ]);
  });
});

describe("telling one finding from another", () => {
  const twice = (claims: Report["claims"]): string =>
    renderNext(reportOf(claims), "/p").split(" · ")[0] ?? "";

  it("counts the same message in two files as two problems", () => {
    expect(
      twice([
        {
          claim: "c",
          guidance: "g",
          findings: [error("same words", "/p/a.ts"), error("same words", "/p/b.ts")],
        },
      ]),
    ).toBe("problem 1 of 2");
  });

  it("counts the same message at two offsets in one file as two problems", () => {
    expect(
      twice([
        {
          claim: "c",
          guidance: "g",
          findings: [
            { severity: "error", message: "same words", file: "/p/a.ts", start: 1 },
            { severity: "error", message: "same words", file: "/p/a.ts", start: 2 },
          ],
        },
      ]),
    ).toBe("problem 1 of 2");
  });

  it("counts the same message in two claims as two problems", () => {
    expect(
      twice([
        { claim: "one", guidance: "g", findings: [error("same words", "/p/a.ts")] },
        { claim: "two", guidance: "g", findings: [error("same words", "/p/a.ts")] },
      ]),
    ).toBe("problem 1 of 2");
  });
});

describe("picking which problem to see first", () => {
  it("shows the named claim rather than whichever came first", () => {
    expect(renderNext(MIXED, "/p", { only: "a-mixed" })).toContain(
      "problem 1 of 1 in `a-mixed` · 3 claims · 1 error · 2 warnings",
    );
  });

  it("counts problems within the filter but keeps the tally of the whole run", () => {
    const both = renderNext(COPIES, "/p", { only: "twice" });

    expect(both.split("\n")[0]).toBe("problem 1 of 2 in `twice` · 2 claims · 4 errors · 0 warnings");
  });

  it("matches on any part of the name, so the whole claim need not be typed", () => {
    expect(renderNext(COPIES, "/p", { only: "boundary" })).toContain(
      "every-import-respects-its-zone-boundary",
    );
  });

  it("says so loudly when the filter matches no claim, and names the ones there are", () => {
    expect(renderNext(COPIES, "/p", { only: "bondary" })).toBe(
      [
        "no claim matches `bondary` · 2 claims · 4 errors · 0 warnings",
        "",
        "    no-declaration-is-written-twice",
        "    every-import-respects-its-zone-boundary",
      ].join("\n"),
    );
  });

  it("keeps the run's own tally when the filter is clean, so it cannot read as all clear", () => {
    const clean = reportOf([
      { claim: "a-passing-claim", guidance: "g", findings: [] },
      COPIES.claims[1] as Report["claims"][number],
    ]);

    expect(renderNext(clean, "/p", { only: "passing" })).toBe(
      "nothing left to fix in `passing` · 2 claims · 1 error · 0 warnings",
    );
  });
});

describe("showing one problem at a time", () => {
  it("keeps findings that share a cause together", () => {
    const output = renderNext(COPIES, "/p");

    expect(output).toContain("a.ts");
    expect(output).toContain("b.ts");
    expect(output).toContain("2 errors");
  });

  it("leaves the unrelated copy for a later pass", () => {
    expect(renderNext(COPIES, "/p")).not.toContain("c.ts");
  });

  it("counts the problems rather than the findings", () => {
    expect(renderNext(COPIES, "/p")).toContain("problem 1 of 3");
  });

  it("treats findings with no shared cause as one problem each", () => {
    const single = reportOf([COPIES.claims[1] as Report["claims"][number]]);
    expect(renderNext(single, "/p")).toContain("problem 1 of 1");
  });
});
