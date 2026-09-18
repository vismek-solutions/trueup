import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { verdictFrom } from "../support/guard.ts";

const PROJECT = fixtureAt("guarded-text");
const verdictOn = verdictFrom(PROJECT);

const CLEAN = "# Clean\n\nA pause, here.\n";
const MARKED = "# Clean\n\nA pause — here.\n";

describe("guarding a guide", () => {
  it("refuses a write that puts a banned mark into a file that is clean on disk", async () => {
    expect(await verdictOn("docs/clean.md", MARKED)).toBe("deny");
  });

  it("allows a write that leaves it clean", async () => {
    expect(await verdictOn("docs/clean.md", CLEAN)).toBe("allowed");
  });

  it("judges a guide that does not exist yet", async () => {
    expect(await verdictOn("docs/new.md", MARKED)).toBe("deny");
  });

  it("says nothing about a guide falling in no zone, since no zone can hold one", async () => {
    expect(await verdictOn("docs/clean.md", CLEAN)).not.toContain("matches no zone");
  });
});
