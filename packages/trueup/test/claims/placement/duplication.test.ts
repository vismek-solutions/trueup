import { describe, expect, it } from "vitest";
import { fixtureAt } from "../../support/fixtures.ts";
import { findingsIn, messagesIn } from "../../support/report.ts";
import { check } from "../../../src/main.ts";
import type { Report } from "../../../src/report/model.ts";

const ROOT = fixtureAt("copied");
const CLAIM = "no-declaration-is-written-twice";
const SHARED_DECLARATION = 80;
const SHARED = "declares label, which is written the same way in src/notice.ts";

const runWith = (duplication?: number): Promise<Report> =>
  check({
    root: ROOT,
    zones: [{ name: "app", patterns: ["src/**"] }],
    ...(duplication === undefined ? {} : { duplication }),
  });

describe("finding the same declaration written twice", () => {
  it("says nothing until a size is set", async () => {
    expect((await runWith()).claims.find((claim) => claim.claim === CLAIM)).toBeUndefined();
  });

  it("names every file holding a copy, and the others it matches", async () => {
    const reported = messagesIn(await runWith(40), CLAIM);

    expect(reported).toContain("declares slugify, which is written the same way in src/three.ts, src/two.ts");
    expect(reported).toContain("declares slugify, which is written the same way in src/one.ts, src/three.ts");
  });

  it("matches a copy that was renamed, since the name is not part of the comparison", async () => {
    expect(messagesIn(await runWith(40), CLAIM)).toContain(
      "declares toSlug, which is written the same way in src/one.ts, src/two.ts",
    );
  });

  it("reports a copy that appears in exactly two files", async () => {
    expect(messagesIn(await runWith(40), CLAIM)).toContain(SHARED);
  });

  it("matches a copy written over more lines, since a run of whitespace counts as one space", async () => {
    expect(messagesIn(await runWith(40), CLAIM)).toContain(
      "declares headers, which is written the same way in src/mirror.ts",
    );
  });

  it("keeps the space that tells two texts apart, rather than deleting it", async () => {
    expect(messagesIn(await runWith(40), CLAIM).some((message) => message.includes("heading"))).toBe(false);
  });

  it("ignores a declaration shorter than the size given", async () => {
    expect(messagesIn(await runWith(400), CLAIM)).toEqual([]);
  });

  it("keeps a declaration exactly as long as the size given", async () => {
    expect(messagesIn(await runWith(SHARED_DECLARATION), CLAIM)).toContain(SHARED);
  });

  it("measures the declaration without the space in front of it", async () => {
    expect(messagesIn(await runWith(SHARED_DECLARATION + 1), CLAIM)).not.toContain(SHARED);
  });

  it("orders the copies by what was written, not by where it was found", async () => {
    expect(messagesIn(await runWith(40), CLAIM)).toEqual([
      SHARED,
      "declares notice, which is written the same way in src/label.ts",
      "declares slugify, which is written the same way in src/three.ts, src/two.ts",
      "declares toSlug, which is written the same way in src/one.ts, src/two.ts",
      "declares slugify, which is written the same way in src/one.ts, src/three.ts",
      "declares headers, which is written the same way in src/mirror.ts",
      "declares headers, which is written the same way in src/gateway.ts",
    ]);
  });

  it("leaves a declaration that only looks similar alone", async () => {
    expect(messagesIn(await runWith(40), CLAIM).some((message) => message.includes("different"))).toBe(false);
  });

  it("points at the declaration rather than the top of the file", async () => {
    expect(findingsIn(await runWith(40), CLAIM)[0]?.start).toBeGreaterThan(0);
  });

  it("tells the reader to keep one and delete the rest", async () => {
    const claim = (await runWith(40)).claims.find((entry) => entry.claim === CLAIM);
    expect(claim?.guidance).toContain("Keep one");
  });
});
