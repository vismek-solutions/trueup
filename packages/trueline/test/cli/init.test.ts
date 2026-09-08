import { cpSync, mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXIT_BAD_USAGE } from "../../src/cli/main.ts";
import { runInit } from "../../src/cli/init/run.ts";
import { fixtureAt } from "../support/fixtures.ts";

const CONFIG = "trueline.config.ts";

const staged = (name: string): string => {
  const directory = mkdtempSync(join(tmpdir(), "trueline-init-"));
  cpSync(fixtureAt(name), directory, { recursive: true });
  return directory;
};

const initIn = (cwd: string, argv: readonly string[] = []) => {
  const lines: string[] = [];
  const code = runInit({ cwd, argv, write: (line) => lines.push(line) });
  return { code, said: lines.join("\n") };
};

const configAt = (...segments: readonly string[]): string => readFileSync(join(...segments), "utf8");

describe("starting a single package", () => {
  it("zones the tests, each source group and the rest", () => {
    const directory = staged("init-solo");
    initIn(directory);

    expect(configAt(directory, CONFIG)).toContain(
      [
        '    { name: "spec", patterns: ["test/**"], role: "tests" },',
        '    { name: "api", patterns: ["src/api/**"] },',
        '    { name: "domain", patterns: ["src/domain/**"] },',
        '    { name: "app", patterns: ["src/**"], role: "wiring" },',
      ].join("\n"),
    );
  });

  it("wires only the linters the package.json already has", () => {
    const directory = staged("init-solo");
    initIn(directory);
    const written = configAt(directory, CONFIG);

    expect(written).toContain('import { defineConfig, biomeRunner, eslintRunner } from "trueline";');
    expect(written).not.toContain("oxlintRunner");
  });

  it("scopes each runner to the directories the zones cover, so node_modules is not linted", () => {
    const directory = staged("init-solo");
    initIn(directory);
    const written = configAt(directory, CONFIG);

    expect(written).toContain('biomeRunner({ categories: ["lint"], paths: ["test", "src"] })');
    expect(written).toContain('eslintRunner({ patterns: ["test", "src"] })');
  });

  it("refuses to overwrite a config that is already there", () => {
    const directory = staged("init-solo");
    initIn(directory);
    const first = configAt(directory, CONFIG);

    const again = initIn(directory);

    expect(again.code).toBe(EXIT_BAD_USAGE);
    expect(again.said).toContain("already exists");
    expect(configAt(directory, CONFIG)).toBe(first);
  });
});

describe("starting a workspace", () => {
  it("names the workspace globs as members instead of zoning the root", () => {
    const directory = staged("init-workspace");
    initIn(directory);
    const written = configAt(directory, CONFIG);

    expect(written).toContain('members: ["packages/*", "apps/*"],');
    expect(written).not.toContain("zones:");
  });

  it("gives every package a rulebook of its own", () => {
    const directory = staged("init-workspace");
    initIn(directory);

    expect(configAt(directory, "packages", "lib", CONFIG)).toContain(
      '{ name: "domain", patterns: ["src/domain/**"] }',
    );
    expect(existsSync(join(directory, "apps", "web", CONFIG))).toBe(true);
  });

  it("leaves a package that already had one untouched", () => {
    const directory = staged("init-workspace");
    const { said } = initIn(directory);

    expect(said).toContain("kept  packages/ui/trueline.config.ts");
    expect(configAt(directory, "packages", "ui", CONFIG)).toContain('{ name: "kept"');
  });

  it("says which packages hold no source yet, because their zones match nothing", () => {
    const directory = staged("init-workspace");
    const { said } = initIn(directory);

    expect(said).toContain("no source packages/empty");
  });
});

describe("refusing arguments it does not know", () => {
  it("takes none", () => {
    const directory = staged("init-solo");
    const { code, said } = initIn(directory, ["--members"]);

    expect(code).toBe(EXIT_BAD_USAGE);
    expect(said).toContain("unrecognised: --members");
    expect(existsSync(join(directory, CONFIG))).toBe(false);
  });
});
