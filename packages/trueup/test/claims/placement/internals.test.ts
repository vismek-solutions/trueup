import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../../support/fixtures.ts";
import { claimIn, messagesIn } from "../../support/report.ts";
import { check } from "../../../src/compose.ts";
import type { Report } from "../../../src/report/model.ts";
import type { ZoneDefinition } from "../../../src/zones/model.ts";

const ROOT = fixtureAt("internals");
const CLAIM = "no-test-reaches-an-internal";

const ZONES: readonly ZoneDefinition[] = [
  { name: "spec", patterns: ["src/spec/**"], role: "tests" },
  { name: "gate", patterns: ["src/api/**"], role: "api" },
  { name: "wire", patterns: ["src/wire/**"], role: "wiring" },
  { name: "core", patterns: ["src/core/**"] },
  { name: "web", patterns: ["src/web/**"] },
];

const runWith = (zones: readonly ZoneDefinition[] = ZONES): Report =>
  check({ root: ROOT, zones, testInternals: true });

describe("holding a test to the surface its subject already has", () => {
  it("stays quiet until switched on", () => {
    expect(claimIn(check({ root: ROOT, zones: ZONES }), CLAIM)).toBeUndefined();
  });

  it("reports a test reaching a symbol only the file next door calls", () => {
    expect(messagesIn(runWith(), CLAIM)).toEqual([
      "reaches strayIn, an internal of src/core/keys.ts that only src/core/load.ts calls",
    ]);
  });

  it("names the test that reached, not the file that declared", () => {
    expect(claimIn(runWith(), CLAIM)?.findings[0]?.file).toBe(join(ROOT, "src/spec/core.check.ts"));
  });

  it("reports it as an error, since the test is bound to a split that may move", () => {
    expect(claimIn(runWith(), CLAIM)?.findings[0]?.severity).toBe("error");
  });

  it("says nothing about a symbol production reaches from more than one directory", () => {
    expect(messagesIn(runWith(), CLAIM).join()).not.toContain("reachedFromAfar");
  });

  it("says nothing about an internal no test reaches, which is nobody's business but its own", () => {
    expect(messagesIn(runWith(), CLAIM).join()).not.toContain("noTestReadsThis");
  });

  it("says nothing about a symbol only the tests reach, which the sibling claim owns", () => {
    expect(messagesIn(runWith(), CLAIM).join()).not.toContain("loadThing");
  });

  it("says nothing about a wiring zone, a composition root with no internals to protect", () => {
    expect(messagesIn(runWith(), CLAIM).join()).not.toContain("wiringDetail");
  });

  it("counts a symbol an api zone republishes as surface, though no edge leads back to it", () => {
    expect(messagesIn(runWith(), CLAIM).join()).not.toContain("publishedThing");
  });

  it("reports that same symbol once the api zone stops publishing it", () => {
    const unpublished = ZONES.filter((zone) => zone.role !== "api");

    expect(messagesIn(runWith(unpublished), CLAIM)).toContain(
      "reaches publishedThing, an internal of src/core/published.ts that only src/core/load.ts calls",
    );
  });

  it("reports the wiring symbol too once that zone loses its role", () => {
    const plain = ZONES.map((zone) => (zone.role === "wiring" ? { ...zone, role: undefined } : zone));

    expect(messagesIn(runWith(plain), CLAIM)).toContain(
      "reaches wiringDetail, an internal of src/wire/detail.ts that only src/wire/main.ts calls",
    );
  });

  it("warns rather than passing quietly when no zone carries the tests role", () => {
    const untested: readonly ZoneDefinition[] = [{ name: "all", patterns: ["src/**"] }];

    expect(messagesIn(runWith(untested), CLAIM)).toEqual([
      "no zone has the tests role, so there are no tests to hold to a surface",
    ]);
  });

  it("keeps that a warning, since a project may simply have no tests zone yet", () => {
    const untested: readonly ZoneDefinition[] = [{ name: "all", patterns: ["src/**"] }];

    expect(claimIn(runWith(untested), CLAIM)?.findings[0]?.severity).toBe("warning");
  });

  it("names the two fixes that would leave the codebase worse", () => {
    const guidance = claimIn(runWith(), CLAIM)?.guidance ?? "";

    expect(guidance).toContain("Widening that surface");
    expect(guidance).toContain("adding a production caller to justify it");
  });

  it("tells the reader when a direct test is the honest answer", () => {
    expect(claimIn(runWith(), CLAIM)?.guidance).toContain(
      "asking to become a module with a caller of its own",
    );
  });
});
