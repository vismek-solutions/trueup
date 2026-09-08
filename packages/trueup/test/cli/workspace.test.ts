import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { workspaceGlobsIn } from "../../src/cli/init/workspace.ts";

const withFiles = (files: Record<string, string>): string => {
  const directory = mkdtempSync(join(tmpdir(), "trueup-workspace-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(directory, name), content, "utf8");
  }
  return directory;
};

const yaml = (body: string): string => withFiles({ "pnpm-workspace.yaml": body });

describe("reading a pnpm workspace", () => {
  it("takes the globs under `packages:`", () => {
    expect(workspaceGlobsIn(yaml('packages:\n  - "packages/*"\n  - "apps/*"\n'))).toEqual([
      "packages/*",
      "apps/*",
    ]);
  });

  it("reads an unquoted entry, which pnpm also accepts", () => {
    expect(workspaceGlobsIn(yaml("packages:\n  - packages/*\n"))).toEqual(["packages/*"]);
  });

  it("keeps reading past a blank line and a comment", () => {
    const body = 'packages:\n  - "packages/*"\n\n  # the apps\n  - "apps/*"\n';

    expect(workspaceGlobsIn(yaml(body))).toEqual(["packages/*", "apps/*"]);
  });

  it("treats a line of spaces as blank, since an editor leaves those behind", () => {
    const body = 'packages:\n  - "packages/*"\n   \n  - "apps/*"\n';

    expect(workspaceGlobsIn(yaml(body))).toEqual(["packages/*", "apps/*"]);
  });

  it("finds the key below a leading comment rather than only on the first line", () => {
    const body = '# the workspace\npackages:\n  - "packages/*"\n';

    expect(workspaceGlobsIn(yaml(body))).toEqual(["packages/*"]);
  });

  it("finds the key with trailing whitespace behind it", () => {
    const body = 'packages:   \n  - "packages/*"\n';

    expect(workspaceGlobsIn(yaml(body))).toEqual(["packages/*"]);
  });

  it("reads no list that has no `packages:` key above it", () => {
    expect(workspaceGlobsIn(yaml('  - "packages/*"\ncatalog:\n'))).toEqual([]);
  });

  it("stops at the next top-level key rather than swallowing its values", () => {
    const body = 'packages:\n  - "packages/*"\ncatalog:\n  - "not-a-package"\n';

    expect(workspaceGlobsIn(yaml(body))).toEqual(["packages/*"]);
  });

  it("says nothing when the file names no `packages:` key", () => {
    expect(workspaceGlobsIn(yaml('catalog:\n  - "react"\n'))).toEqual([]);
  });

  it("does not mistake a key that merely ends in packages", () => {
    expect(workspaceGlobsIn(yaml('otherpackages:\n  - "packages/*"\n'))).toEqual([]);
  });
});

describe("falling back to package.json", () => {
  it("reads the array form", () => {
    const directory = withFiles({
      "package.json": JSON.stringify({ workspaces: ["packages/*", "apps/*"] }),
    });

    expect(workspaceGlobsIn(directory)).toEqual(["packages/*", "apps/*"]);
  });

  it("reads the object form npm also accepts", () => {
    const directory = withFiles({
      "package.json": JSON.stringify({ workspaces: { packages: ["packages/*"] } }),
    });

    expect(workspaceGlobsIn(directory)).toEqual(["packages/*"]);
  });

  it("prefers the pnpm file where a repository carries both", () => {
    const directory = withFiles({
      "pnpm-workspace.yaml": 'packages:\n  - "from-pnpm/*"\n',
      "package.json": JSON.stringify({ workspaces: ["from-npm/*"] }),
    });

    expect(workspaceGlobsIn(directory)).toEqual(["from-pnpm/*"]);
  });

  it("keeps only the strings, so a malformed entry is dropped rather than carried", () => {
    const directory = withFiles({
      "package.json": JSON.stringify({ workspaces: ["packages/*", 5, null] }),
    });

    expect(workspaceGlobsIn(directory)).toEqual(["packages/*"]);
  });

  it("says nothing for a null workspaces, rather than reading through it", () => {
    const directory = withFiles({ "package.json": JSON.stringify({ workspaces: null }) });

    expect(workspaceGlobsIn(directory)).toEqual([]);
  });

  it("says nothing for a package.json with no workspaces at all", () => {
    const directory = withFiles({ "package.json": JSON.stringify({ name: "solo" }) });

    expect(workspaceGlobsIn(directory)).toEqual([]);
  });

  it("says nothing where there is no manifest to read", () => {
    expect(workspaceGlobsIn(withFiles({}))).toEqual([]);
  });
});
