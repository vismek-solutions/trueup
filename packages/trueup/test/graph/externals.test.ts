import { describe, expect, it } from "vitest";
import { analyze, check } from "../../src/compose.ts";
import type { SymbolGraph } from "../../src/graph/model.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { messagesIn } from "../support/report.ts";

const ROOT = fixtureAt("supplied");
const CLAIM = "every-import-resolves";
const ZONES = [{ name: "site", patterns: ["**"] }];

const graphWith = (externals?: readonly string[]): SymbolGraph =>
  analyze({ roots: [ROOT], ...(externals === undefined ? {} : { externals }) });

const specifiersLeftUnresolved = (externals?: readonly string[]): string[] =>
  graphWith(externals).unresolvedImports.map((entry) => entry.specifier);

describe("specifiers a build tool supplies", () => {
  it("fails the run when nothing declares them, so a typo cannot pass as a virtual module", () => {
    expect(specifiersLeftUnresolved()).toEqual(["astro:content", "virtual:site/heading"]);
  });

  it("resolves the ones a pattern names", () => {
    expect(specifiersLeftUnresolved(["astro:*", "virtual:*"])).toEqual([]);
  });

  it("lets a star cross a slash, because a specifier is not a path", () => {
    expect(specifiersLeftUnresolved(["astro:content", "virtual:*"])).toEqual([]);
  });

  it("leaves a specifier no pattern names failing", () => {
    expect(specifiersLeftUnresolved(["astro:*"])).toEqual(["virtual:site/heading"]);
  });

  it("never lets a pattern swallow an import of the project's own files", () => {
    const targets = graphWith(["*"])
      .edges.filter((edge) => edge.imported === "title")
      .map((edge) => edge.to.kind);
    expect(targets).toEqual(["symbol"]);
  });

  it("marks the edge external rather than dropping it", () => {
    const edge = graphWith(["astro:*"]).edges.find((entry) => entry.imported === "getCollection");
    expect(edge?.to).toEqual({ kind: "external", path: null });
  });

  it("clears the claim that a docs app would otherwise fail on", async () => {
    const report = await check({ root: ROOT, zones: ZONES, externals: ["astro:*", "virtual:*"] });
    expect(messagesIn(report, CLAIM)).toEqual([]);
  });
});
