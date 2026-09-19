import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../../support/fixtures.ts";
import { claimIn } from "../../support/report.ts";
import type { DirectoryLimit } from "../../../src/claims/placement/directories.ts";
import { check } from "../../../src/main.ts";
import type { Report } from "../../../src/report/model.ts";

const ROOT = fixtureAt("project");
const CLAIM = "no-directory-holds-too-many-files";

const runWith = (maxFilesPerDirectory?: number): Promise<Report> =>
  check({
    root: ROOT,
    zones: [
      { name: "engine", patterns: ["src/engine/**"] },
      { name: "domain", patterns: ["src/domain/**"] },
    ],
    ...(maxFilesPerDirectory === undefined ? {} : { maxFilesPerDirectory }),
  });

describe("holding a directory to a size", () => {
  it("says nothing about directories until a limit is set", async () => {
    expect(claimIn(await runWith(), CLAIM)).toBeUndefined();
  });

  it("passes when every directory is under the limit", async () => {
    expect(claimIn(await runWith(5), CLAIM)?.findings).toEqual([]);
  });

  it("names the directory and how far over it is", async () => {
    const findings = claimIn(await runWith(0), CLAIM)?.findings ?? [];

    expect(findings.map((finding) => finding.file)).toEqual([
      ROOT,
      join(ROOT, "src/domain"),
      join(ROOT, "src/engine"),
    ]);
    expect(findings[0]?.message).toBe("holds 1 files, more than the 0 allowed");
  });

  it("reports a directory rather than a position inside a file", async () => {
    expect(claimIn(await runWith(0), CLAIM)?.findings[0]?.start).toBeNull();
  });

  it("tells the reader that raising the limit is not the fix", async () => {
    expect(claimIn(await runWith(5), CLAIM)?.guidance).toContain("Not the fix: raising the limit.");
  });
});

describe("holding one part of a tree to its own size", () => {
  const withLimits = async (
    fallback: number,
    directoryLimits: readonly DirectoryLimit[],
  ): Promise<readonly string[]> =>
    (
      claimIn(
        await check({
          root: ROOT,
          zones: [
            { name: "engine", patterns: ["src/engine/**"] },
            { name: "domain", patterns: ["src/domain/**"] },
          ],
          maxFilesPerDirectory: fallback,
          directoryLimits,
        }),
        CLAIM,
      )?.findings ?? []
    ).map((finding) => finding.file ?? "");

  it("holds a directory under a limit to it, not only the one the limit names", async () => {
    expect(await withLimits(0, [{ within: join(ROOT, "src"), max: 5 }])).toEqual([ROOT]);
  });

  it("takes the deepest limit covering a directory, in whichever order they arrive", async () => {
    const deep = { within: join(ROOT, "src/engine"), max: 5 };
    const shallow = { within: ROOT, max: 0 };
    const overSized = [ROOT, join(ROOT, "src/domain")];

    expect(await withLimits(9, [shallow, deep])).toEqual(overSized);
    expect(await withLimits(9, [deep, shallow])).toEqual(overSized);
  });
});
