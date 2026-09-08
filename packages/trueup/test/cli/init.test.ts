import { cpSync, mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXIT_BAD_USAGE } from "../../src/cli/main.ts";
import { runInit } from "../../src/cli/init/run.ts";
import { fixtureAt } from "../support/fixtures.ts";

const CONFIG = "trueup.config.ts";

const staged = (name: string): string => {
  const directory = mkdtempSync(join(tmpdir(), "trueup-init-"));
  cpSync(fixtureAt(name), directory, { recursive: true });
  return directory;
};

const initIn = (cwd: string, argv: readonly string[] = []) => {
  const lines: string[] = [];
  const code = runInit({ cwd, argv, write: (line) => lines.push(line) });
  return { code, said: lines.join("\n") };
};

const configAt = (...segments: readonly string[]): string => readFileSync(join(...segments), "utf8");

describe("what it says when it is done", () => {
  it("says exactly this for a single package, so a dropped line is a failure", () => {
    const directory = staged("init-solo");

    expect(initIn(directory).said).toBe(
      [
        "wrote trueup.config.ts",
        "",
        "zones     spec · api · domain · app",
        "runners   biomeRunner · eslintRunner, over test · src only",
        "",
        "next      add `boundaries` to say which zones may reach which",
        "          turn on `colocation`, `duplication` and `maxFilesPerDirectory` once a first run is clean",
        "          run `trueup` to see what it finds",
      ].join("\n"),
    );
  });

  it("says exactly this where a package has a zone per folder and no linter is installed", () => {
    const directory = staged("init-crowded");

    expect(initIn(directory).said).toBe(
      [
        "wrote trueup.config.ts",
        "wrote packages/big/trueup.config.ts",
        "",
        "members   packages/*",
        "runners   none, no linter in package.json",
        "",
        "crowded   big got 11 zones, one per folder",
        "          consider merging any two you would never write a rule between",
        "",
        "next      add `boundaries` to say which zones may reach which",
        "          turn on `colocation`, `duplication` and `maxFilesPerDirectory` once a first run is clean",
        "          run `trueup` to see what it finds",
      ].join("\n"),
    );
  });

  it("says exactly this for a workspace, caveats and all", () => {
    const directory = staged("init-workspace");

    expect(initIn(directory).said).toBe(
      [
        "wrote trueup.config.ts",
        "wrote apps/web/trueup.config.ts",
        "wrote packages/empty/trueup.config.ts",
        "wrote packages/lib/trueup.config.ts",
        "kept  packages/ui/trueup.config.ts, already there",
        "",
        "members   packages/* · apps/*",
        "runners   fallowRunner · oxlintRunner, over packages · apps only",
        "",
        "no zone   e2e",
        "          source no member claims; give it zones in the root config, or it fails as",
        "          unclassified and your linters never see it",
        "",
        "no source packages/empty",
        "          their zones match nothing until those hold code, or narrow `members`",
        "",
        "next      add `boundaries` to say which zones may reach which",
        "          turn on `colocation`, `duplication` and `maxFilesPerDirectory` once a first run is clean",
        "          run `trueup` to see what it finds",
      ].join("\n"),
    );
  });
});

describe("what it writes, to the character", () => {
  it("writes this root config for a workspace", () => {
    const directory = staged("init-workspace");
    initIn(directory);

    expect(configAt(directory, CONFIG)).toBe(
      [
        'import { defineConfig, fallowRunner, oxlintRunner } from "trueup";',
        "",
        "export default defineConfig({",
        '  members: ["packages/*", "apps/*"],',
        "  runners: [",
        "    fallowRunner(),",
        '    oxlintRunner({ paths: ["packages", "apps"] }),',
        "  ],",
        "});",
        "",
      ].join("\n"),
    );
  });

  it("writes this member config, grant and all", () => {
    const directory = staged("init-workspace");
    initIn(directory);

    expect(configAt(directory, "apps", "web", CONFIG)).toBe(
      [
        'import { defineMember } from "trueup";',
        "",
        "export default defineMember({",
        '  allow: ["lib", "ui"],',
        "  zones: [",
        '    { name: "pages", patterns: ["src/pages/**"] },',
        '    { name: "evals", patterns: ["evals/**"] },',
        '    { name: "app", patterns: ["**"] },',
        "  ],",
        "});",
        "",
      ].join("\n"),
    );
  });

  it("writes the door first, so it wins first-match over the zones behind it", () => {
    const directory = staged("init-workspace");
    initIn(directory);

    expect(configAt(directory, "packages", "lib", CONFIG)).toBe(
      [
        'import { defineMember } from "trueup";',
        "",
        "export default defineMember({",
        "  zones: [",
        '    { name: "api", patterns: ["src/index.ts", "src/vet/index.ts"], role: "api" },',
        '    { name: "domain", patterns: ["src/domain/**"] },',
        '    { name: "vet", patterns: ["src/vet/**"] },',
        "  ],",
        "});",
        "",
      ].join("\n"),
    );
  });
});

describe("starting a single package", () => {
  it("zones the tests, each source group and the rest", () => {
    const directory = staged("init-solo");
    initIn(directory);

    expect(configAt(directory, CONFIG)).toContain(
      [
        '    { name: "spec", patterns: ["test/**"], role: "tests" },',
        '    { name: "api", patterns: ["src/api/**"] },',
        '    { name: "domain", patterns: ["src/domain/**"] },',
        '    { name: "app", patterns: ["**"] },',
      ].join("\n"),
    );
  });

  it("wires only the linters the package.json already has", () => {
    const directory = staged("init-solo");
    initIn(directory);
    const written = configAt(directory, CONFIG);

    expect(written).toContain('import { defineConfig, biomeRunner, eslintRunner } from "trueup";');
    expect(written).not.toContain("oxlintRunner");
  });

  it("scopes each runner to the directories the zones cover, so node_modules is not linted", () => {
    const directory = staged("init-solo");
    initIn(directory);
    const written = configAt(directory, CONFIG);

    expect(written).toContain('biomeRunner({ categories: ["lint"], paths: ["test", "src"] })');
    expect(written).toContain('eslintRunner({ patterns: ["test", "src"] })');
  });

  it("writes no pattern that matches nothing, which its own claims would reject", () => {
    const directory = staged("init-solo");
    initIn(directory);

    expect(configAt(directory, CONFIG)).not.toContain("*.spec.*");
  });

  it("sweeps whatever the source folders missed, rather than only src", () => {
    const directory = staged("init-workspace");
    initIn(directory);

    expect(configAt(directory, "apps", "web", CONFIG)).toContain('{ name: "evals", patterns: ["evals/**"] }');
    expect(configAt(directory, "apps", "web", CONFIG)).toContain('{ name: "app", patterns: ["**"] }');
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

    expect(said).toContain("kept  packages/ui/trueup.config.ts");
    expect(configAt(directory, "packages", "ui", CONFIG)).toContain('{ name: "kept"');
  });

  it("still gives a package with no source a zone, or loading the config throws", () => {
    const directory = staged("init-workspace");
    initIn(directory);

    expect(configAt(directory, "packages", "empty", CONFIG)).toContain('{ name: "app", patterns: ["**"] },');
  });

  it("says which packages hold no source yet, because their zones match nothing", () => {
    const directory = staged("init-workspace");
    const { said } = initIn(directory);

    expect(said).toContain("no source packages/empty");
  });

  it("seeds `allow` from the workspace dependencies the package already declares", () => {
    const directory = staged("init-workspace");
    initIn(directory);

    expect(configAt(directory, "apps", "web", CONFIG)).toContain('allow: ["lib", "ui"],');
  });

  it("names them in a stable order rather than package.json's", () => {
    const directory = staged("init-workspace");
    initIn(directory);

    expect(configAt(directory, "apps", "web", CONFIG)).not.toContain('allow: ["ui", "lib"],');
  });

  it("leaves `allow` out where nothing in the workspace is depended on", () => {
    const directory = staged("init-workspace");
    initIn(directory);

    expect(configAt(directory, "packages", "lib", CONFIG)).not.toContain("allow:");
  });

  it("makes the exported barrel a door, so a grant does not open the whole package", () => {
    const directory = staged("init-workspace");
    initIn(directory);

    expect(configAt(directory, "packages", "lib", CONFIG)).toContain(
      '{ name: "api", patterns: ["src/index.ts", "src/vet/index.ts"], role: "api" }',
    );
  });

  it("names the top-level directories no member claims", () => {
    const directory = staged("init-workspace");
    const { said } = initIn(directory);

    expect(said).toContain("no zone   e2e");
  });

  it("does not list the rulebooks it just wrote as uncovered source", () => {
    const directory = staged("init-workspace");
    const { said } = initIn(directory);

    expect(said.split("\n").find((line) => line.startsWith("no zone"))).not.toContain(CONFIG);
  });

  it("says the runners only cover what the zones cover", () => {
    const directory = staged("init-workspace");
    const { said } = initIn(directory);

    expect(said).toContain("over packages · apps only");
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
