import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { manifestIn } from "../../src/config/manifest.ts";
import { fixtureAt } from "../support/fixtures.ts";

const MANIFESTS = fixtureAt("manifests");

const read = (shape: string) => manifestIn(join(MANIFESTS, shape));

describe("a package.json this tool cannot read", () => {
  it("answers nothing for a directory holding no manifest at all", () => {
    expect(manifestIn(MANIFESTS)).toBeNull();
  });

  it("answers nothing rather than throwing when the JSON will not parse", () => {
    expect(read("broken-json")).toBeNull();
  });

  it("answers nothing when the manifest parses to something that is not an object", () => {
    expect(read("not-an-object")).toBeNull();
  });

  it("answers nothing for a manifest holding null, which typeof calls an object", () => {
    expect(read("null-manifest")).toBeNull();
  });
});

describe("the name a package gives itself", () => {
  it("is null when the manifest omits it, so a caller never reads undefined", () => {
    expect(read("nameless")?.name).toBeNull();
  });

  it("is null when it is present but not a string, rather than passed through as one", () => {
    expect(read("numeric-name")?.name).toBeNull();
  });

  it("is the name when there is one", () => {
    expect(read("every-field")?.name).toBe("@manifests/every-field");
  });
});

describe("the dependencies a manifest declares", () => {
  it("gathers all four fields, since any of them can name a package that must resolve", () => {
    expect(read("every-field")?.dependencies).toEqual([
      "runtime-one",
      "tooling-one",
      "peer-one",
      "optional-one",
    ]);
  });

  it("skips a field holding null or something that is not an object, and keeps the rest", () => {
    expect(read("odd-fields")?.dependencies).toEqual(["peer-one"]);
  });

  it("is empty rather than absent when the manifest declares none", () => {
    expect(read("nameless")?.dependencies).toEqual([]);
  });
});

describe("the fields this tool passes through untouched", () => {
  it("hands back exports as written, leaving every shape of it to the reader", () => {
    expect(read("nameless")?.exports).toBe("./src/index.ts");
  });

  it("hands back workspaces the same way", () => {
    expect(read("every-field")?.workspaces).toEqual(["packages/*"]);
  });

  it("leaves both undefined when the manifest sets neither", () => {
    expect(read("numeric-name")?.exports).toBeUndefined();
    expect(read("numeric-name")?.workspaces).toBeUndefined();
  });
});
