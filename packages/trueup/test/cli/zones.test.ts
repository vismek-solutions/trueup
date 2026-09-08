import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { sourceFilesIn, topDirectoriesIn, zonesFor } from "../../src/cli/init/zones.ts";

const holding = (...paths: readonly string[]): string => {
  const directory = mkdtempSync(join(tmpdir(), "trueup-zones-"));
  for (const path of paths) {
    const at = join(directory, path);
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, "export const x = 1;\n", "utf8");
  }
  return directory;
};

const exporting = (entry: string, ...paths: readonly string[]): string => {
  const directory = holding(...paths);
  const manifest = { name: "packaged", type: "module", exports: { ".": entry } };
  writeFileSync(join(directory, "package.json"), JSON.stringify(manifest), "utf8");
  return directory;
};

const namesOf = (directory: string): readonly string[] =>
  zonesFor(directory, sourceFilesIn(directory)).map((zone) => zone.name);

describe("finding the source to zone", () => {
  it("walks past the directories the analysis itself ignores", () => {
    const directory = holding("src/a.ts", "node_modules/pkg/b.ts", "dist/c.ts");

    expect(sourceFilesIn(directory)).toEqual(["src/a.ts"]);
  });

  it("says nothing for a directory that is not there, rather than throwing", () => {
    expect(sourceFilesIn(join(holding("a.ts"), "missing"))).toEqual([]);
  });
});

describe("naming zones that would collide", () => {
  it("suffixes the second, so a door and a folder of the same name both survive", () => {
    const directory = exporting("./src/api/index.ts", "src/api/index.ts", "src/api/client.ts");

    expect(namesOf(directory)).toEqual(["api", "api2"]);
  });

  it("keeps the door pointing at the exported file only", () => {
    const directory = exporting("./src/api/index.ts", "src/api/index.ts", "src/api/client.ts");
    const zones = zonesFor(directory, sourceFilesIn(directory));

    expect(zones[0]?.declaration).toBe('{ name: "api", patterns: ["src/api/index.ts"], role: "api" }');
    expect(zones[1]?.declaration).toBe('{ name: "api2", patterns: ["src/api/**"] }');
  });
});

describe("scoping a runner to the directories the zones cover", () => {
  it("takes the leading segment of each pattern", () => {
    expect(topDirectoriesIn(["test/**", "src/api/**", "src/domain/**"])).toEqual(["test", "src"]);
  });

  it("drops a pattern whose leading segment is itself a glob, which would scope to nothing", () => {
    expect(topDirectoriesIn(["**", "**/*.test.ts", "src/**"])).toEqual(["src"]);
  });
});
