import { describe, expect, it } from "vitest";
import { fixtureAt } from "../../support/fixtures.ts";
import { messagesIn } from "../../support/report.ts";
import { check } from "../../../src/compose.ts";
import type { BoundaryRule } from "../../../src/claims/boundary.ts";

const ROOT = fixtureAt("copied-across");
const CLAIM = "no-declaration-is-written-twice";

const ZONES = [
  { name: "app", patterns: ["src/app/**"] },
  { name: "web", patterns: ["src/web/**"] },
  { name: "store", patterns: ["src/store/**"] },
  { name: "lib", patterns: ["src/lib/**"] },
];

const LAYERED: BoundaryRule[] = [
  { from: "app", allow: ["store", "lib"] },
  { from: "web", allow: ["store", "lib"] },
  { from: "store", allow: ["lib"] },
  { from: "lib", allow: [] },
];

const SEALED: BoundaryRule[] = [
  { from: "app", allow: [] },
  { from: "web", allow: [] },
];

const about = async (name: string, boundaries: BoundaryRule[]): Promise<string> =>
  messagesIn(await check({ root: ROOT, zones: ZONES, boundaries, duplication: 40 }), CLAIM).find((message) =>
    message.startsWith(`declares ${name},`),
  ) ?? "";

describe("saying where a copy written in two zones could be shared", () => {
  it("names the zone that reaches what the declaration needs", async () => {
    expect(await about("total", LAYERED)).toBe(
      "declares total, which is written the same way in src/web/totals.ts, and a shared copy may live in store",
    );
  });

  it("names every zone that would do, ordered by name rather than by the rulebook", async () => {
    expect(await about("slug", LAYERED)).toBe(
      "declares slug, which is written the same way in src/web/slugs.ts, and a shared copy may live in lib or store",
    );
  });

  it("says so when no zone may be reached from every copy", async () => {
    expect(await about("slug", SEALED)).toBe(
      "declares slug, which is written the same way in src/web/slugs.ts, and no zone may hold a copy all of them could reach",
    );
  });

  it("stays quiet when both copies are in one zone, since that zone is the answer", async () => {
    expect(await about("tidy", LAYERED)).toBe(
      "declares tidy, which is written the same way in src/app/tidy.ts",
    );
  });
});
