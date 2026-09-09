import { describe, expect, it } from "vitest";
import { countOf, withoutDuplicates } from "../../src/report/model.ts";
import type { ClaimResult, Finding, Report } from "../../src/report/model.ts";

const finding = (over: Partial<Finding> = {}): Finding => ({
  severity: "error",
  message: "says the same thing",
  file: "/p/a.ts",
  start: 10,
  ...over,
});

const claimOf = (...findings: readonly Finding[]): ClaimResult => ({
  claim: "a-claim",
  guidance: "do the thing",
  findings,
});

const keptBy = (...findings: readonly Finding[]): readonly Finding[] =>
  withoutDuplicates([claimOf(...findings)])[0]?.findings ?? [];

describe("two findings that say the same thing in the same place", () => {
  it("are reported once, since two tools finding it does not make it twice wrong", () => {
    expect(keptBy(finding(), finding())).toHaveLength(1);
  });

  it("are still one when neither names a file", () => {
    expect(keptBy(finding({ file: null }), finding({ file: null }))).toHaveLength(1);
  });

  it("are still one when neither names a position", () => {
    expect(keptBy(finding({ start: null }), finding({ start: null }))).toHaveLength(1);
  });
});

describe("what makes two findings different", () => {
  it("the position, so the same complaint twice in one file stays twice", () => {
    expect(keptBy(finding(), finding({ start: 40 }))).toHaveLength(2);
  });

  it("the file, so the same complaint about two files stays two", () => {
    expect(keptBy(finding(), finding({ file: "/p/b.ts" }))).toHaveLength(2);
  });

  it("the message, so two complaints about one line stay two", () => {
    expect(keptBy(finding(), finding({ message: "says something else" }))).toHaveLength(2);
  });

  it("but not the severity, since the same finding twice is not two by disagreeing on it", () => {
    expect(keptBy(finding(), finding({ severity: "warning" }))).toHaveLength(1);
  });
});

describe("a claim with nothing to remove", () => {
  it("is handed back as it was, rather than rebuilt", () => {
    const claim = claimOf(finding(), finding({ start: 40 }));

    expect(withoutDuplicates([claim])[0]).toBe(claim);
  });

  it("keeps what it was told, in the order it was told", () => {
    expect(keptBy(finding({ start: 40 }), finding()).map((kept) => kept.start)).toEqual([40, 10]);
  });

  it("keeps every claim, not only the ones it changed", () => {
    expect(withoutDuplicates([claimOf(finding()), claimOf()])).toHaveLength(2);
  });
});

describe("counting what a report found", () => {
  const report: Report = {
    claims: [claimOf(finding(), finding({ severity: "warning", start: 40 })), claimOf(finding({ start: 70 }))],
    coverage: {
      files: 1,
      edges: 0,
      symbolEdges: 0,
      externalEdges: 0,
      builtinEdges: 0,
      namespaceEdges: 0,
      unresolvedImports: 0,
      filesByZone: {},
      unclassifiedFiles: 0,
    },
  };

  it("adds up one severity across every claim, not only the first", () => {
    expect(countOf(report, "error")).toBe(2);
  });

  it("counts the other severity apart from it", () => {
    expect(countOf(report, "warning")).toBe(1);
  });
});
