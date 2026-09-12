import { describe, expect, it } from "vitest";
import { check } from "../../src/compose.ts";
import type { ZoneDefinition } from "../../src/zones/model.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { messagesIn } from "../support/report.ts";

const ROOT = fixtureAt("tangled");
const CLAIM = "no-zones-form-a-cycle";

const ZONES: readonly ZoneDefinition[] = [
  { name: "alpha", patterns: ["alpha/**"] },
  { name: "beta", patterns: ["beta/**"] },
  { name: "gamma", patterns: ["gamma/**"] },
  { name: "left", patterns: ["left/**"] },
  { name: "right", patterns: ["right/**"] },
  { name: "free", patterns: ["free/**"] },
  { name: "server", patterns: ["api/**"] },
  { name: "browser", patterns: ["web/**"] },
];

const zonedAs = async (zones: readonly ZoneDefinition[]): Promise<readonly string[]> =>
  messagesIn(await check({ root: ROOT, zones }), CLAIM);

describe("zones that depend on each other", () => {
  it("reports a pair that imports each other", async () => {
    expect(await zonedAs(ZONES)).toContain("zones left and right form an import cycle");
  });

  it("reports a cycle that closes through a third zone", async () => {
    expect(await zonedAs(ZONES)).toContain("zones alpha, beta and gamma form an import cycle");
  });

  it("reports each tangle once rather than once per zone in it", async () => {
    expect(await zonedAs(ZONES)).toHaveLength(3);
  });

  it("names the zones in a tangle by name, not by the order their imports were read", async () => {
    expect(await zonedAs(ZONES)).toContain("zones browser and server form an import cycle");
  });

  it("keeps tangles apart when one of them reaches into another", async () => {
    expect(await zonedAs(ZONES)).toEqual([
      "zones alpha, beta and gamma form an import cycle",
      "zones browser and server form an import cycle",
      "zones left and right form an import cycle",
    ]);
  });

  it("leaves alone a zone that only reaches into a cycle", async () => {
    expect((await zonedAs(ZONES)).join(" ")).not.toContain("free");
  });

  it("sees no cycle when the zones that close it are one zone", async () => {
    const merged: readonly ZoneDefinition[] = [
      { name: "ring", patterns: ["alpha/**", "beta/**", "gamma/**"] },
      { name: "left", patterns: ["left/**"] },
      { name: "right", patterns: ["right/**"] },
      { name: "free", patterns: ["free/**"] },
    ];
    expect(await zonedAs(merged)).toEqual(["zones left and right form an import cycle"]);
  });
});
