import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { analyze } from "../src/compose.js";
import { consumersOf } from "../src/graph/model.js";

const GAIME = "/Users/marianvismek/Dev/Vismek/gaime";
const SHARED = join(GAIME, "packages/shared/src");

const consumerFilesOf = (name: string, declaredIn: string): string[] => {
  const graph = analyze({ roots: [join(GAIME, "apps/web/src"), SHARED] });
  const edges = consumersOf(graph, { path: join(SHARED, declaredIn), name });
  return [...new Set(edges.map((edge) => relative(GAIME, edge.from)))].sort();
};

describe.skipIf(!existsSync(GAIME))("gaime: symbols resolved through the shared barrel", () => {
  it("resolves Warrant to exactly its three consumers", () => {
    expect(consumerFilesOf("Warrant", "warrants.ts")).toEqual([
      "apps/web/src/components/prikaz/Prikaz.tsx",
      "apps/web/src/components/prikaz/prikazView.ts",
      "apps/web/src/desk/runView.ts",
    ]);
  });

  it("distinguishes WarrantKind from Warrant", () => {
    expect(consumerFilesOf("WarrantKind", "warrants.ts")).toEqual([
      "apps/web/src/components/prikaz/Prikaz.tsx",
      "apps/web/src/components/prikaz/PrikazVysledek.tsx",
      "apps/web/src/components/prikaz/prikazView.ts",
      "apps/web/src/components/prikaz/warrantEvidence.ts",
    ]);
  });
});
