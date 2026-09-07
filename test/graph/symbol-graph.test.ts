import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyze } from "../../src/compose.ts";
import type { EdgeTarget, SymbolGraph } from "../../src/graph/model.ts";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

const graphOf = (fixture: string): SymbolGraph => analyze({ roots: [join(FIXTURES, fixture)] });

const targetOf = (graph: SymbolGraph, consumer: string, imported: string): EdgeTarget => {
  const edge = graph.edges.find(
    (candidate) => candidate.from.endsWith(consumer) && candidate.imported === imported,
  );
  if (edge === undefined) throw new Error(`no edge for ${imported} in ${consumer}`);
  return edge.to;
};

describe("re-export chains", () => {
  const graph = graphOf("barrel");

  it("resolves a star re-export to the declaring file", () => {
    expect(targetOf(graph, "consumer.ts", "one")).toEqual({
      kind: "symbol",
      path: join(FIXTURES, "barrel/alpha.ts"),
      name: "one",
    });
  });

  it("keeps the barrel it travelled through separate from the file that declares it", () => {
    const edge = graph.edges.find((candidate) => candidate.imported === "one");
    expect(edge?.via).toBe(join(FIXTURES, "barrel/index.ts"));
    expect(edge?.to).toEqual({ kind: "symbol", path: join(FIXTURES, "barrel/alpha.ts"), name: "one" });
  });

  it("resolves an aliased named re-export to its original local name", () => {
    expect(targetOf(graph, "consumer.ts", "uno")).toEqual({
      kind: "symbol",
      path: join(FIXTURES, "barrel/alpha.ts"),
      name: "one",
    });
  });

  it("resolves a type-only binding and records it as a type edge", () => {
    const edge = graph.edges.find((candidate) => candidate.imported === "Alpha");
    expect(edge?.kind).toBe("type");
    expect(edge?.to).toEqual({ kind: "symbol", path: join(FIXTURES, "barrel/alpha.ts"), name: "Alpha" });
  });

  it("resolves a namespace re-export to the re-exported module", () => {
    expect(targetOf(graph, "consumer.ts", "beta")).toEqual({
      kind: "namespace",
      path: join(FIXTURES, "barrel/beta.ts"),
    });
  });

  it("treats a whole-barrel namespace import as reaching the barrel itself", () => {
    expect(targetOf(graph, "consumer.ts", "*")).toEqual({
      kind: "namespace",
      path: join(FIXTURES, "barrel/index.ts"),
    });
  });

  it("does not carry a default export across a star re-export", () => {
    expect(targetOf(graph, "consumer.ts", "default")).toEqual({
      kind: "missing-export",
      path: join(FIXTURES, "barrel/index.ts"),
      name: "default",
    });
  });

  it("reports a name no module in the chain exports", () => {
    expect(targetOf(graph, "consumer.ts", "absent")).toEqual({
      kind: "missing-export",
      path: join(FIXTURES, "barrel/index.ts"),
      name: "absent",
    });
  });
});

describe("degraded input", () => {
  it("reports the same name reached through two star re-exports as ambiguous", () => {
    const target = targetOf(graphOf("ambiguous"), "consumer.ts", "shared");
    expect(target.kind).toBe("ambiguous");
    expect(
      target.kind === "ambiguous" && target.candidates.map((candidate) => candidate.path).sort(),
    ).toEqual([join(FIXTURES, "ambiguous/left.ts"), join(FIXTURES, "ambiguous/right.ts")]);
  });

  it("terminates on mutually recursive star re-exports", () => {
    const graph = graphOf("cycle");
    expect(targetOf(graph, "consumer.ts", "fromA")).toEqual({
      kind: "symbol",
      path: join(FIXTURES, "cycle/a.ts"),
      name: "fromA",
    });
    expect(targetOf(graph, "consumer.ts", "fromB")).toEqual({
      kind: "symbol",
      path: join(FIXTURES, "cycle/b.ts"),
      name: "fromB",
    });
  });

  it("records an unresolved specifier instead of dropping it", () => {
    const graph = graphOf("unresolved");
    expect(graph.unresolvedImports.map((entry) => entry.specifier).sort()).toEqual([
      "./also-nowhere.css",
      "./nowhere.js",
    ]);
  });

  it("emits no edges for an unresolved specifier", () => {
    expect(graphOf("unresolved").edges).toEqual([]);
  });
});
