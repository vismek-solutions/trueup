import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { exportedFilesIn } from "../../src/config/exports.ts";
import { fixtureAt } from "../support/fixtures.ts";

const SHAPES = fixtureAt("exports-shapes");

const readableIn = (shape: string): readonly string[] => {
  const directory = join(SHAPES, shape);
  return (exportedFilesIn(directory)?.files ?? []).map(
    (entry) => `${entry.subpath}=${relative(directory, entry.file)}`,
  );
};

const surfaceOf = (shape: string) => exportedFilesIn(join(SHAPES, shape));

describe("reading a package's public surface from its manifest", () => {
  it("takes a bare string as the whole surface, which is the shortest form there is", () => {
    expect(readableIn("plain-string")).toEqual([".=src/index.ts"]);
  });

  it("prefers the import condition, since that is the one this analysis follows", () => {
    expect(readableIn("conditions")).toEqual([".=src/esm.ts"]);
  });

  it("falls back to the default condition when no import condition is offered", () => {
    expect(readableIn("default-only")).toEqual([".=src/fallback.ts"]);
  });

  it("reads conditions nested under a subpath, not only at the top", () => {
    expect(readableIn("conditional-subpath")).toEqual([".=src/index.ts", "./vet=src/vet.ts"]);
  });

  it("resolves every target against the package, so a caller never joins paths itself", () => {
    const first = surfaceOf("plain-string")?.files[0];

    expect(first?.file).toBe(join(SHAPES, "plain-string", "src/index.ts"));
  });
});

describe("a manifest that names no surface this analysis can read", () => {
  it("says nothing for a package that declares no exports at all", () => {
    expect(surfaceOf("no-exports")).toBeNull();
  });

  it("says nothing for exports set to null, which publishes nothing on purpose", () => {
    expect(surfaceOf("null-exports")).toBeNull();
  });

  it("says nothing for a value that is neither a string nor an object", () => {
    expect(surfaceOf("numeric-exports")).toBeNull();
  });

  it("says nothing when a condition holds something that is not a path", () => {
    expect(surfaceOf("unreadable-condition")).toBeNull();
  });

  it("says nothing when every subpath is a wildcard, since none names a file", () => {
    expect(surfaceOf("only-wildcards")).toBeNull();
  });

  it("says nothing for a directory holding no manifest at all", () => {
    expect(exportedFilesIn(SHAPES)).toBeNull();
  });
});

describe("whether the surface is the whole of what a package publishes", () => {
  it("is complete when every subpath named a file", () => {
    expect(surfaceOf("conditional-subpath")?.complete).toBe(true);
  });

  it("is incomplete when a wildcard subpath sits beside the named ones", () => {
    expect(exportedFilesIn(join(fixtureAt("doors"), "packages/globbed"))?.complete).toBe(false);
  });
});
