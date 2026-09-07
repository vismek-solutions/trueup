import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { check } from "../src/compose.ts";
import type { Report } from "../src/report/model.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "project");
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

const claimIn = (report: Report) => report.claims.find((claim) => claim.claim === CLAIM);

describe("holding a directory to a size", () => {
  it("says nothing about directories until a limit is set", () => {
    expect(claimIn(runWith())).toBeUndefined();
  });

  it("passes when every directory is under the limit", () => {
    expect(claimIn(runWith(5))?.findings).toEqual([]);
  });

  it("names the directory and how far over it is", () => {
    const findings = claimIn(runWith(0))?.findings ?? [];

    expect(findings.map((finding) => finding.file)).toEqual([
      ROOT,
      join(ROOT, "src/domain"),
      join(ROOT, "src/engine"),
    ]);
    expect(findings[0]?.message).toBe("holds 1 files, more than the 0 allowed");
  });

  it("reports a directory rather than a position inside a file", () => {
    expect(claimIn(runWith(0))?.findings[0]?.start).toBeNull();
  });

  it("tells the reader that raising the limit is not the fix", () => {
    expect(claimIn(runWith(5))?.guidance).toContain("Raising the limit is not the fix");
  });
});
