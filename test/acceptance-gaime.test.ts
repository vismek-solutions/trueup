import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import type { EdgeAnchor } from "../src/claims/boundary.ts";
import { analyze, check } from "../src/compose.ts";
import { consumersOf } from "../src/graph/model.ts";

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

const offendingFiles = (anchor: EdgeAnchor): string[] => {
  const report = check({
    root: GAIME,
    roots: [join(GAIME, "apps/web/src"), SHARED],
    zones: [
      { name: "warrants", patterns: ["packages/shared/src/warrants.ts"] },
      { name: "shared", patterns: ["packages/shared/src/**"] },
      { name: "components", patterns: ["apps/web/src/components/**"] },
      { name: "web", patterns: ["apps/web/src/**"] },
    ],
    boundaries: [{ from: "components", mayNotReach: ["warrants"], anchor }],
  });

  const findings =
    report.claims.find((claim) => claim.claim === "every-import-respects-its-zone-boundary")?.findings ?? [];
  return [...new Set(findings.map((finding) => relative(GAIME, finding.file ?? "")))].sort();
};

describe.skipIf(!existsSync(GAIME))("gaime: a boundary rule against one module of a shared package", () => {
  it("names the four component files that reach warrants through the barrel", () => {
    expect(offendingFiles("declaring-file")).toEqual([
      "apps/web/src/components/prikaz/Prikaz.tsx",
      "apps/web/src/components/prikaz/PrikazVysledek.tsx",
      "apps/web/src/components/prikaz/prikazView.ts",
      "apps/web/src/components/prikaz/warrantEvidence.ts",
    ]);
  });

  it("finds nothing at all when anchored on the module the specifier named", () => {
    expect(offendingFiles("imported-module")).toEqual([]);
  });
});
