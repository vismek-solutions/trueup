import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { check } from "../../src/compose.ts";
import type { Finding, Report } from "../../src/report/model.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "copied");
const CLAIM = "no-declaration-is-written-twice";

const runWith = (duplication?: number): Report =>
  check({
    root: ROOT,
    zones: [{ name: "app", patterns: ["src/**"] }],
    ...(duplication === undefined ? {} : { duplication }),
  });

const findingsIn = (report: Report): readonly Finding[] =>
  report.claims.find((claim) => claim.claim === CLAIM)?.findings ?? [];

const messages = (report: Report): string[] => findingsIn(report).map((finding) => finding.message);

describe("finding the same declaration written twice", () => {
  it("says nothing until a size is set", () => {
    expect(runWith().claims.find((claim) => claim.claim === CLAIM)).toBeUndefined();
  });

  it("names every file holding a copy, and the others it matches", () => {
    const reported = messages(runWith(40));

    expect(reported).toContain("declares slugify, which is written the same way in src/three.ts, src/two.ts");
    expect(reported).toContain("declares slugify, which is written the same way in src/one.ts, src/three.ts");
  });

  it("matches a copy that was renamed, since the name is not part of the comparison", () => {
    expect(messages(runWith(40))).toContain(
      "declares toSlug, which is written the same way in src/one.ts, src/two.ts",
    );
  });

  it("ignores a declaration shorter than the size given", () => {
    expect(messages(runWith(400))).toEqual([]);
  });

  it("leaves a declaration that only looks similar alone", () => {
    expect(messages(runWith(40)).some((message) => message.includes("different"))).toBe(false);
  });

  it("points at the declaration rather than the top of the file", () => {
    expect(findingsIn(runWith(40))[0]?.start).toBeGreaterThan(0);
  });

  it("tells the reader to keep one and delete the rest", () => {
    const claim = runWith(40).claims.find((entry) => entry.claim === CLAIM);
    expect(claim?.guidance).toContain("Keep one");
  });
});
