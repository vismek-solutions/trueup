import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { sourceFilesIn, topDirectoriesIn, zonesFor } from "../../../src/cli/init/zones.ts";

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

  it("counts up until the name is free, rather than stopping at a fixed try", () => {
    const directory = exporting(
      "./src/api/index.ts",
      "src/api/index.ts",
      "src/api/client.ts",
      "api/legacy.ts",
      "api2/older.ts",
    );

    expect(namesOf(directory)).toEqual(["api", "api2", "api3", "api22"]);
  });

  it("keeps the door pointing at the exported file only", () => {
    const directory = exporting("./src/api/index.ts", "src/api/index.ts", "src/api/client.ts");
    const zones = zonesFor(directory, sourceFilesIn(directory));

    expect(zones[0]?.declaration).toBe('{ name: "api", patterns: ["src/api/index.ts"], role: "api" }');
    expect(zones[1]?.declaration).toBe('{ name: "api2", patterns: ["src/api/**"] }');
  });
});

describe("making a door of what the package exports", () => {
  it("opens no door onto build output, and leaves the name free for the folder", () => {
    const directory = exporting("./dist/index.js", "dist/index.js", "src/api/client.ts");

    expect(namesOf(directory)).toEqual(["api"]);
  });
});

describe("scoping a runner to the directories the zones cover", () => {
  it("takes the leading segment of each pattern", () => {
    expect(topDirectoriesIn(["test/**", "src/api/**", "src/domain/**"])).toEqual(["test", "src"]);
  });

  it("drops a pattern whose leading segment is itself a glob, which would scope to nothing", () => {
    expect(topDirectoriesIn(["**", "**/*.test.ts", "src/**"])).toEqual(["src"]);
  });

  it("drops a pattern anchored at the filesystem root, which names no directory here", () => {
    expect(topDirectoriesIn(["/etc/**", "src/**"])).toEqual(["src"]);
  });

  it("takes a pattern naming one file as its own directory", () => {
    expect(topDirectoriesIn(["src/index.ts", "index.ts"])).toEqual(["src", "index.ts"]);
  });
});
