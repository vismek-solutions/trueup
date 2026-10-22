import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "../../src/cli/render.ts";
import { renderDots } from "../../src/cli/reports/tagged.ts";
import type { Report } from "../../src/report/model.ts";
import { COVERAGE, error, MIXED, reportOf } from "../support/sample-report.ts";

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
        "coverage  3 files · 2 edges · 2 symbol · 0 namespace · 0 external · 0 builtin · 0 unresolved",
        "zones     app 2 · domain 1 · 0 unclassified",
        "",
        `${LONG}  2 errors`,
        "    a.ts  said with a file",
        "    said with no file",
        "    ────────",
        "    g",
        "",
        "",
        "1 claim · 2 errors · 0 warnings",
      ].join("\n"),
    );
  });

  it("lists a finding that names no file as an item of its own in the dots report", () => {
    expect(renderDots(WIDE, "/p")).toBe(
      [
        "<marks>E</marks>",
        "<coverage>3 files, 2 edges, 0 unresolved</coverage>",
        "",
        `<claim name="${LONG}" errors="2">`,
        "<findings>",
        "* a.ts said with a file",
        "* said with no file",
        "</findings>",
        "<guidance>",
        "g",
        "</guidance>",
        "</claim>",
        "",
        "<summary>1 claim, 2 errors, 0 warnings</summary>",
      ].join("\n"),
    );
  });

  it("names each zone it counted, separated, rather than only the first", () => {
    expect(render(WIDE, "/p")).toContain("zones     app 2 · domain 1 · 0 unclassified");
  });
});

describe("a finding whose message runs to several lines", () => {
  const LISTED = reportOf([
    {
      claim: "a-claim",
      guidance: "g",
      findings: [
        error("serves 2 readerships:\n- alpha from src/one\n- beta from src/two", "/p/a.ts"),
        error("holds two of them:\n- gamma\n- delta", null),
      ],
    },
  ]);

  it("indents every line after the first past the location, so one finding reads as one block", () => {
    expect(render(LISTED, "/p")).toContain(
      [
        "    a.ts  serves 2 readerships:",
        "        - alpha from src/one",
        "        - beta from src/two",
      ].join("\n"),
    );
  });

  it("indents the same way where the finding names no file, so the two line up", () => {
    expect(render(LISTED, "/p")).toContain(
      ["    holds two of them:", "        - gamma", "        - delta"].join("\n"),
    );
  });

  it("keeps a finding one item in the dots report, its later lines indented under the first", () => {
    expect(renderDots(LISTED, "/p")).toContain("* a.ts serves 2 readerships:\n  - alpha from src/one");
  });
});

describe("the full report, to the character", () => {
  it("writes exactly this, so a dropped column or blank line is a failure", () => {
    expect(render(MIXED, "/p")).toBe(
      [
        "coverage  3 files · 2 edges · 2 symbol · 0 namespace · 0 external · 0 builtin · 0 unresolved",
        "zones     app 3 · 0 unclassified",
        "",
        "a-passing-claim                             ok",
        "a-mixed-claim                               1 error · 1 warning",
        "    a.ts  an error here",
        "    a warning here",
        "    ────────",
        "    alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar",
        "    papa quebec romeo",
        "",
        "a-warning-claim                             1 warning",
        "    b.ts  only a warning",
        "    ────────",
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
        "<marks>.E!</marks>",
        "<coverage>3 files, 2 edges, 0 unresolved</coverage>",
        "",
        '<claim name="a-mixed-claim" errors="1">',
        "<findings>",
        "* a.ts an error here",
        "</findings>",
        "<guidance>",
        "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo",
        "</guidance>",
        "</claim>",
        "",
        "<summary>3 claims, 1 error, 2 warnings</summary>",
      ].join("\n"),
    );
  });

  it("marks a claim that only warns apart from one that passed and one that failed", () => {
    expect(renderDots(MIXED, "/p").split("\n")[0]).toBe("<marks>.E!</marks>");
  });

  it("adds a baseline line only when there is a baseline", () => {
    expect(renderDots(MIXED, "/p", { known: 4, stale: 0 })).toContain("<baseline>4 known, 0 stale</baseline>");
    expect(renderDots(MIXED, "/p")).not.toContain("baseline");
  });
});

describe("wrapping the guidance in the full report", () => {
  const wrapped = (guidance: string): string[] =>
    render(reportOf([{ claim: "c", guidance, findings: [error("m", "/p/a.ts")] }]), "/p")
      .split("\n")
      .filter((line) => line.startsWith("    "));

  it("keeps a line that lands exactly on the width", () => {
    expect(wrapped(`${"a".repeat(50)} ${"b".repeat(45)}`)).toEqual([
      "    a.ts  m",
      "    ────────",
      `    ${"a".repeat(50)} ${"b".repeat(45)}`,
    ]);
  });

  it("breaks the line that would pass the width by one", () => {
    expect(wrapped(`${"a".repeat(50)} ${"b".repeat(46)}`)).toEqual([
      "    a.ts  m",
      "    ────────",
      `    ${"a".repeat(50)}`,
      `    ${"b".repeat(46)}`,
    ]);
  });
});

describe("pointing at a place inside a file that is really there", () => {
  let root = "";
  let file = "";

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "trueup-render-"));
    file = join(root, "a.ts");
    writeFileSync(file, "alpha\nbravo\ncharlie\n", "utf8");
  });

  const shown = (start: number | null): string =>
    render(
      reportOf([
        {
          claim: "a-claim",
          guidance: "g",
          findings: [{ severity: "error", message: "here", file, start }],
        },
      ]),
      root,
    );

  it("counts the column from the start of its own line rather than from the file", () => {
    expect(shown(8)).toContain("a.ts:2:3  here");
  });

  it("names the file alone where the finding carries no offset, rather than guessing the first byte", () => {
    expect(shown(null)).toContain("    a.ts  here");
    expect(shown(null)).not.toContain("a.ts:");
  });
});
