import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";

const SPLIT = fixtureAt("split-rulebook");
const TYPELESS = fixtureAt("typeless-package");
const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "trueup.js");

// vitest resolves `./x.js` to `./x.ts` itself, so only a real node process can tell whether the
// loader fallback these tests are about is present at all
const underNode = (cwd: string): { readonly said: string; readonly status: number | null } => {
  const run = spawnSync(process.execPath, [BIN, "--json"], { cwd, encoding: "utf8" });
  return { said: `${run.stdout}${run.stderr}`, status: run.status };
};

describe("a rulebook split across files, read by node rather than by the test runner", () => {
  it("resolves a sibling written the way TypeScript says to write it", () => {
    expect(underNode(SPLIT).said).toContain("from-a-sibling-file");
  });

  it("resolves one whose specifier names an emitted module too", () => {
    expect(underNode(SPLIT).said).toContain("from-an-emitted-module");
  });

  it("runs those rules rather than loading the sibling and dropping them", () => {
    expect(underNode(SPLIT).status).toBe(0);
  });
});

describe("a rulebook in a package that declares no module type", () => {
  it("reads it without node warning the project about how it had to be parsed", () => {
    expect(underNode(TYPELESS).said).not.toContain("MODULE_TYPELESS_PACKAGE_JSON");
  });

  it("still reads the rulebook, rather than buying quiet by refusing it", () => {
    expect(underNode(TYPELESS).status).toBe(0);
  });
});
