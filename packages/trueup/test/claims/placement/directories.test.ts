import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../../support/fixtures.ts";
import { claimIn } from "../../support/report.ts";
import type { DirectoryLimit } from "../../../src/claims/placement/directories.ts";
import { check } from "../../../src/compose.ts";
import type { Report } from "../../../src/report/model.ts";

const ROOT = fixtureAt("project");
const CLAIM = "no-directory-holds-too-many-files";

const runWith = (maxFilesPerDirectory?: number): Report =>
  check({
    root: ROOT,
    zones: [
      { name: "engine", patterns: ["src/engine/**"] },
      { name: "domain", patterns: ["src/domain/**"] },
    ],
    ...(maxFilesPerDirectory === undefined ? {} : { maxFilesPerDirectory }),
  });

describe("holding a directory to a size", () => {
  it("says nothing about directories until a limit is set", () => {
    expect(claimIn(runWith(), CLAIM)).toBeUndefined();
  });

  it("passes when every directory is under the limit", () => {
    expect(claimIn(runWith(5), CLAIM)?.findings).toEqual([]);
  });

  it("names the directory and how far over it is", () => {
    const findings = claimIn(runWith(0), CLAIM)?.findings ?? [];

    expect(findings.map((finding) => finding.file)).toEqual([
      ROOT,
      join(ROOT, "src/domain"),
      join(ROOT, "src/engine"),
    ]);
    expect(findings[0]?.message).toBe("holds 1 files, more than the 0 allowed");
  });

  it("reports a directory rather than a position inside a file", () => {
    expect(claimIn(runWith(0), CLAIM)?.findings[0]?.start).toBeNull();
  });

  it("tells the reader that raising the limit is not the fix", () => {
    expect(claimIn(runWith(5), CLAIM)?.guidance).toContain("Raising the limit is not the fix");
  });
});

describe("holding one part of a tree to its own size", () => {
  const withLimits = (fallback: number, directoryLimits: readonly DirectoryLimit[]): readonly string[] =>
    (
      claimIn(
        check({
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

  it("holds a directory under a limit to it, not only the one the limit names", () => {
    expect(withLimits(0, [{ within: join(ROOT, "src"), max: 5 }])).toEqual([ROOT]);
  });

  it("takes the deepest limit covering a directory, in whichever order they arrive", () => {
    const deep = { within: join(ROOT, "src/engine"), max: 5 };
    const shallow = { within: ROOT, max: 0 };
    const overSized = [ROOT, join(ROOT, "src/domain")];

    expect(withLimits(9, [shallow, deep])).toEqual(overSized);
    expect(withLimits(9, [deep, shallow])).toEqual(overSized);
  });
});
