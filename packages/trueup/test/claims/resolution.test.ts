import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { check } from "../../src/compose.ts";
import type { Report } from "../../src/report/model.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { claimIn, findingsIn, messagesIn } from "../support/report.ts";

const REACHED = "the-analysis-reached-files";
const RESOLVES = "every-import-resolves";
const EXPORTED = "every-imported-name-is-exported";
const UNAMBIGUOUS = "every-imported-name-is-unambiguous";

const over = (fixture: string): Report =>
  check({ root: fixtureAt(fixture), zones: [{ name: "all", patterns: ["**"] }] });

describe("an import that resolves to no file", () => {
  it("names the specifier and what the resolver said about it", () => {
    expect(messagesIn(over("unresolved"), RESOLVES)).toEqual([
      "imports ./nowhere.js, which does not resolve (Cannot find module './nowhere.js')",
      "imports ./also-nowhere.css, which does not resolve (Cannot find module './also-nowhere.css')",
    ]);
  });

  it("reports a bare side-effect import too, which brings in a file just the same", () => {
    expect(messagesIn(over("unresolved"), RESOLVES).join()).toContain("also-nowhere.css");
  });

  it("points at the importing file, since that is where the specifier is written", () => {
    const findings = findingsIn(over("unresolved"), RESOLVES);

    expect(findings[0]?.file).toBe(join(fixtureAt("unresolved"), "consumer.ts"));
  });

  it("carries the position of each import, so two on one file are told apart", () => {
    const starts = findingsIn(over("unresolved"), RESOLVES).map((finding) => finding.start);

    expect(new Set(starts).size).toBe(starts.length);
  });

  it("fails rather than warns, since a rule that cannot see an edge passes it in silence", () => {
    expect(findingsIn(over("unresolved"), RESOLVES).every((finding) => finding.severity === "error")).toBe(
      true,
    );
  });
});

describe("an imported name the module does not export", () => {
  it("names the imported name and the module it asked", () => {
    expect(messagesIn(over("barrel"), EXPORTED)).toEqual([
      "imports default from ./index.js, which does not export it",
      "imports absent from ./index.js, which does not export it",
    ]);
  });

  it("says nothing about the names that barrel does re-export, however far they travelled", () => {
    const said = messagesIn(over("barrel"), EXPORTED).join();

    expect(said).not.toContain(" one ");
    expect(said).not.toContain(" uno ");
    expect(said).not.toContain(" beta ");
  });

  it("reports a missing default separately from a missing named export", () => {
    expect(findingsIn(over("barrel"), EXPORTED)).toHaveLength(2);
  });
});

describe("a name two star re-exports both supply", () => {
  it("says which module was asked and that more than one answered", () => {
    expect(messagesIn(over("ambiguous"), UNAMBIGUOUS)).toEqual([
      "imports shared from ./index.js, which re-exports it from more than one module",
    ]);
  });

  it("keeps that apart from a name nothing exports, which is a different fault", () => {
    expect(messagesIn(over("ambiguous"), EXPORTED)).toEqual([]);
  });
});

describe("an analysis that reached nothing", () => {
  it("fails, so a mis-scoped config cannot report success over no files at all", () => {
    expect(messagesIn(over("exports-shapes"), REACHED)).toEqual(["no files were analysed"]);
  });

  it("says nothing once any file was read", () => {
    expect(messagesIn(over("barrel"), REACHED)).toEqual([]);
  });

  it("tells the reader which two settings decide what was reached", () => {
    const guidance = claimIn(over("barrel"), REACHED)?.guidance ?? "";

    expect(guidance).toContain("`include`");
    expect(guidance).toContain("`extensions`");
  });
});
