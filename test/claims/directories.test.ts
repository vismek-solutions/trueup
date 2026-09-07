import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { claimIn } from "../support/report.ts";
import { check } from "../../src/compose.ts";
import type { Report } from "../../src/report/model.ts";

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
