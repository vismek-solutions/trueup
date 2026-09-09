import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURES } from "../support/fixtures.ts";
import { analyze } from "../../src/compose.ts";
import type { EdgeTarget, SymbolGraph } from "../../src/graph/model.ts";

const ROOT = join(FIXTURES, "reaching");
const OUTSIDE = join(FIXTURES, "outside-reaching");
const APART = join(FIXTURES, "reaching-apart");

const graphOf = (root: string): SymbolGraph => analyze({ roots: [root], externals: ["ghost-package"] });

const graph = (): SymbolGraph => graphOf(ROOT);

const reached = (root: string, imported: string): EdgeTarget => {
  const edge = graphOf(root).edges.find((candidate) => candidate.imported === imported);
  if (edge === undefined) throw new Error(`no edge for ${imported}`);
  return edge.to;
};

const targetOf = (imported: string): EdgeTarget => reached(ROOT, imported);

const apart = (imported: string): EdgeTarget => reached(APART, imported);

describe("what a re-export chain ends at", () => {
  it("names the builtin a barrel re-exported, rather than the barrel", () => {
    expect(targetOf("join")).toEqual({ kind: "builtin", name: "node:path" });
  });

  it("keeps the path of a file that resolved but was never analysed", () => {
    expect(targetOf("outside")).toEqual({ kind: "external", path: join(OUTSIDE, "thing.ts") });
  });

  it("reads a module with no export syntax as declaring whatever was asked of it", () => {
    expect(targetOf("legacyThing")).toEqual({
      kind: "symbol",
      path: join(ROOT, "legacy.cjs"),
      name: "legacyThing",
    });
  });
});

describe("a name two star re-exports both reach", () => {
  it("is one answer, not an ambiguity, when both arrive at the same declaration", () => {
    expect(targetOf("shared")).toEqual({ kind: "symbol", path: join(ROOT, "shared.ts"), name: "shared" });
  });

  it("is one answer when both arrive at the same module rather than the same symbol", () => {
    expect(targetOf("bundled")).toEqual({ kind: "namespace", path: join(ROOT, "shared.ts") });
  });
});

describe("a barrel that stars in a package this analysis cannot see", () => {
  it("calls an unknown name external rather than reporting it missing", () => {
    expect(targetOf("unknowable")).toEqual({ kind: "external", path: null });
  });

  it("calls a namespace re-export of that package external too", () => {
    expect(targetOf("ghost")).toEqual({ kind: "external", path: null });
  });

  it("leaves every one of those specifiers resolved, so none is reported unresolved", () => {
    expect(graph().unresolvedImports).toEqual([]);
  });
});

describe("a name two star re-exports reach apart", () => {
  it("keeps both declarations rather than picking one", () => {
    expect(apart("disputed")).toEqual({
      kind: "ambiguous",
      candidates: [
        { path: join(APART, "three.ts"), name: "disputed" },
        { path: join(APART, "four.ts"), name: "disputed" },
      ],
    });
  });

  it("keeps only the declarations, when one of the two is a whole module", () => {
    expect(apart("tangled")).toEqual({
      kind: "ambiguous",
      candidates: [{ path: join(APART, "seven.ts"), name: "tangled" }],
    });
  });

  it("keeps both when they differ only in the name each renamed", () => {
    expect(apart("renamed")).toEqual({
      kind: "ambiguous",
      candidates: [
        { path: join(APART, "shared.ts"), name: "first" },
        { path: join(APART, "shared.ts"), name: "second" },
      ],
    });
  });
});

describe("a name nothing in the chain declares", () => {
  it("is reported missing from the barrel that was asked, through a cycle of stars", () => {
    expect(apart("nothing")).toEqual({
      kind: "missing-export",
      path: join(APART, "barrel.ts"),
      name: "nothing",
    });
  });
});

describe("a named re-export of a module this analysis has no file for", () => {
  it("is external when the package was declared external", () => {
    expect(apart("viaGhost")).toEqual({ kind: "external", path: null });
  });

  it("is external when the specifier resolves to nothing at all", () => {
    expect(apart("viaNowhere")).toEqual({ kind: "external", path: null });
  });
});
