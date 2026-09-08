import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render, renderDots, renderNext } from "../../src/cli/render.ts";
import type { Finding, Report } from "../../src/report/model.ts";
import { fixtureAt } from "../support/fixtures.ts";

const COVERAGE: Report["coverage"] = {
  files: 3,
  edges: 2,
  symbolEdges: 2,
  namespaceEdges: 0,
  externalEdges: 0,
  builtinEdges: 0,
  unresolvedImports: 0,
  filesByZone: { app: 3 },
  unclassifiedFiles: 0,
};

const error = (message: string, file: string | null, group?: string): Finding => ({
  severity: "error",
  message,
  file,
  start: null,
  ...(group === undefined ? {} : { group }),
});

const reportOf = (claims: Report["claims"]): Report => ({ claims, coverage: COVERAGE });

const COPIES = reportOf([
  {
    claim: "no-declaration-is-written-twice",
    guidance: "Keep one, put it where every caller may reach it, and delete the rest.",
    findings: [
      error("declares posix, written the same way elsewhere", "/p/a.ts", "body-one"),
      error("declares posix, written the same way elsewhere", "/p/b.ts", "body-one"),
      error("declares toSlug, written the same way elsewhere", "/p/c.ts", "body-two"),
    ],
  },
  {
    claim: "every-import-respects-its-zone-boundary",
    guidance: "Move the code to a zone that may reach the target.",
    findings: [error("is app and may not reach domain", "/p/d.ts")],
  },
]);

const warning = (message: string, file: string | null): Finding => ({
  severity: "warning",
  message,
  file,
  start: null,
});

const GUIDANCE =
  "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo";

const MIXED = reportOf([
  { claim: "a-passing-claim", guidance: "never shown", findings: [] },
  {
    claim: "a-mixed-claim",
    guidance: GUIDANCE,
    findings: [error("an error here", "/p/a.ts"), warning("a warning here", null)],
  },
  {
    claim: "a-warning-claim",
    guidance: "just the one",
    findings: [warning("only a warning", "/p/b.ts")],
  },
]);

const LONG = "a-claim-whose-name-runs-past-the-default-column";

const WIDE: Report = {
  coverage: { ...COVERAGE, filesByZone: { app: 2, domain: 1 } },
  claims: [
    {
      claim: LONG,
      guidance: "g",
      findings: [error("said with a file", "/p/a.ts"), error("said with no file", null)],
    },
  ],
};

describe("a claim whose name outgrows the column", () => {
  it("widens the column to fit it rather than truncating or colliding", () => {
    expect(render(WIDE, "/p")).toBe(
      [
        "coverage  3 files · 2 edges · 2 symbol · 0 external · 0 builtin · 0 unresolved",
        "zones     app 2 · domain 1 · 0 unclassified",
        "",
        `${LONG}  2 errors`,
        "    a.ts  said with a file",
        "    said with no file",
        "    g",
        "",
        "",
        "1 claim · 2 errors · 0 warnings",
      ].join("\n"),
    );
  });

  it("widens the dots column too, and indents a finding that names no file", () => {
    expect(renderDots(WIDE, "/p")).toBe(
      [
        "E  3 files · 2 edges · 0 unresolved",
        "",
        `${LONG}  2 errors`,
        "    a.ts  said with a file",
        "    said with no file",
        "    g",
        "",
        "1 claim · 2 errors · 0 warnings",
      ].join("\n"),
    );
  });

  it("names each zone it counted, separated, rather than only the first", () => {
    expect(render(WIDE, "/p")).toContain("zones     app 2 · domain 1 · 0 unclassified");
  });
});

describe("the full report, to the character", () => {
  it("writes exactly this, so a dropped column or blank line is a failure", () => {
    expect(render(MIXED, "/p")).toBe(
      [
        "coverage  3 files · 2 edges · 2 symbol · 0 external · 0 builtin · 0 unresolved",
        "zones     app 3 · 0 unclassified",
        "",
        "a-passing-claim                             ok",
        "a-mixed-claim                               1 error · 1 warning",
        "    a.ts  an error here",
        "    a warning here",
        "    alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar",
        "    papa quebec romeo",
        "",
        "a-warning-claim                             1 warning",
        "    b.ts  only a warning",
        "    just the one",
        "",
        "",
        "3 claims · 1 error · 2 warnings",
      ].join("\n"),
    );
  });

  it("adds a baseline line only when there is a baseline", () => {
    expect(render(MIXED, "/p", { known: 4, stale: 1 })).toContain("baseline  4 known · 1 stale");
    expect(render(MIXED, "/p")).not.toContain("baseline");
  });

  it("carries every notice, since a notice is why a number looks wrong", () => {
    const noticed: Report = { ...MIXED, notices: ["ran without a cache", "two runners were skipped"] };

    expect(render(noticed, "/p")).toContain(
      "notice    ran without a cache\nnotice    two runners were skipped",
    );
  });

  it("says none rather than an empty column when nothing was zoned", () => {
    const bare: Report = { ...MIXED, coverage: { ...MIXED.coverage, filesByZone: {} } };

    expect(render(bare, "/p")).toContain("zones     none · 0 unclassified");
  });
});

describe("the dots report, to the character", () => {
  it("writes exactly this, one mark per claim and detail only for the failures", () => {
    expect(renderDots(MIXED, "/p")).toBe(
      [
        ".E!  3 files · 2 edges · 0 unresolved",
        "",
        "a-mixed-claim                               1 error",
        "    a.ts  an error here",
        "    alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar",
        "    papa quebec romeo",
        "",
        "3 claims · 1 error · 2 warnings",
      ].join("\n"),
    );
  });

  it("marks a claim that only warns apart from one that passed and one that failed", () => {
    expect(renderDots(MIXED, "/p").split("  ")[0]).toBe(".E!");
  });

  it("adds a baseline line only when there is a baseline", () => {
    expect(renderDots(MIXED, "/p", { known: 4, stale: 0 })).toContain("baseline  4 known · 0 stale");
    expect(renderDots(MIXED, "/p")).not.toContain("baseline");
  });
});

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

  it("names only the stale count when there is nothing left, since known is not a task", () => {
    expect(renderNext(reportOf([]), "/p", { known: 2, stale: 3 })).toBe(
      "nothing left to fix · 0 claims · 0 errors · 0 warnings\nbaseline  3 stale",
    );
  });

  it("stays silent about a baseline with nothing stale in it", () => {
    expect(renderNext(reportOf([]), "/p", { known: 2, stale: 0 })).toBe(
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

  it("carries the guidance, since it is the whole point of showing one", () => {
    expect(renderNext(COPIES, "/p")).toContain("delete the rest");
  });

  it("says so when there is nothing left", () => {
    expect(renderNext(reportOf([]), "/p")).toContain("nothing left to fix");
  });
});
