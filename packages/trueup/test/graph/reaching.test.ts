import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURES } from "../support/fixtures.ts";
import { analyze } from "../../src/compose.ts";
import type { EdgeTarget, SymbolGraph } from "../../src/graph/model.ts";

const ROOT = join(FIXTURES, "reaching");
const OUTSIDE = join(FIXTURES, "outside-reaching");

const graph = (): SymbolGraph => analyze({ roots: [ROOT], externals: ["ghost-package"] });

const targetOf = (imported: string): EdgeTarget => {
  const edge = graph().edges.find((candidate) => candidate.imported === imported);
  if (edge === undefined) throw new Error(`no edge for ${imported}`);
  return edge.to;
};

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
