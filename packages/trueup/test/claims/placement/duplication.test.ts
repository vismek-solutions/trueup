import { describe, expect, it } from "vitest";
import { fixtureAt } from "../../support/fixtures.ts";
import { findingsIn, messagesIn } from "../../support/report.ts";
import { check } from "../../../src/compose.ts";
import type { Report } from "../../../src/report/model.ts";

const ROOT = fixtureAt("copied");
const CLAIM = "no-declaration-is-written-twice";

const runWith = (duplication?: number): Report =>
  check({
    root: ROOT,
    zones: [{ name: "app", patterns: ["src/**"] }],
    ...(duplication === undefined ? {} : { duplication }),
  });

describe("finding the same declaration written twice", () => {
  it("says nothing until a size is set", () => {
    expect(runWith().claims.find((claim) => claim.claim === CLAIM)).toBeUndefined();
  });

  it("names every file holding a copy, and the others it matches", () => {
    const reported = messagesIn(runWith(40), CLAIM);

    expect(reported).toContain("declares slugify, which is written the same way in src/three.ts, src/two.ts");
    expect(reported).toContain("declares slugify, which is written the same way in src/one.ts, src/three.ts");
  });

  it("matches a copy that was renamed, since the name is not part of the comparison", () => {
    expect(messagesIn(runWith(40), CLAIM)).toContain(
      "declares toSlug, which is written the same way in src/one.ts, src/two.ts",
    );
  });

  it("ignores a declaration shorter than the size given", () => {
    expect(messagesIn(runWith(400), CLAIM)).toEqual([]);
  });

  it("leaves a declaration that only looks similar alone", () => {
    expect(messagesIn(runWith(40), CLAIM).some((message) => message.includes("different"))).toBe(false);
  });

  it("points at the declaration rather than the top of the file", () => {
    expect(findingsIn(runWith(40), CLAIM)[0]?.start).toBeGreaterThan(0);
  });

  it("tells the reader to keep one and delete the rest", () => {
    const claim = runWith(40).claims.find((entry) => entry.claim === CLAIM);
    expect(claim?.guidance).toContain("Keep one");
  });
});
