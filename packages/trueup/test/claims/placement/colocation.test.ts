import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../../support/fixtures.ts";
import { claimIn } from "../../support/report.ts";
import { PROJECT_ZONES as ZONES } from "../../support/zones.ts";
import { renderNext } from "../../../src/cli/render.ts";
import { check } from "../../../src/compose.ts";
import type { Report } from "../../../src/report/model.ts";
import type { ZoneDefinition } from "../../../src/zones/model.ts";

const ROOT = fixtureAt("project");
const CLAIM = "no-value-is-declared-away-from-its-only-consumer";

const runWith = (zones: readonly ZoneDefinition[] = ZONES, colocation = true): Report =>
  check({ root: ROOT, zones, colocation });

describe("keeping a value with its only consumer", () => {
  it("stays quiet until switched on", () => {
    expect(claimIn(check({ root: ROOT, zones: ZONES }), CLAIM)).toBeUndefined();
  });

  it("names the declaring file and the one file that uses it", () => {
    const findings = claimIn(runWith(), CLAIM)?.findings ?? [];

    expect(findings).toHaveLength(1);
    expect(findings[0]?.file).toBe(join(ROOT, "src/domain/thing.ts"));
    expect(findings[0]?.message).toContain("used only by src/engine/runner.ts");
  });

  it("says nothing when the consuming zone never owns what it uses", () => {
    const zones: readonly ZoneDefinition[] = [
      { name: "engine", patterns: ["src/engine/**"], role: "wiring" },
      { name: "domain", patterns: ["src/domain/**"] },
    ];

    expect(claimIn(runWith(zones), CLAIM)?.findings).toEqual([]);
  });

  it("tells the reader when giving a zone a role is honest", () => {
    expect(claimIn(runWith(), CLAIM)?.guidance).toContain("never owns what it uses");
  });

  it("names the thing to move from the shape of the finding, rather than sending the reader to the file", () => {
    const guidance = claimIn(runWith(), CLAIM)?.guidance ?? "";

    expect(guidance).toContain("already decided for you by the shape of the finding");
    expect(guidance).toContain("A finding that counts the exports");
    expect(guidance).toContain("A finding that names one declaration");
  });
});

const SHARED = fixtureAt("colocated");
const TEST_ONLY = "no-export-exists-only-for-a-test";

const sharedReport = (): Report =>
  check({
    root: SHARED,
    colocation: true,
    zones: [
      { name: "spec", patterns: ["src/spec/**"], role: "tests" },
      { name: "gate", patterns: ["src/api/**"], role: "api" },
      { name: "shared", patterns: ["src/shared/**"] },
      { name: "web", patterns: ["src/web/**"] },
      { name: "server", patterns: ["src/server/**"] },
    ],
  });

const messagesFor = (claim: string): readonly string[] =>
  sharedReport()
    .claims.find((entry) => entry.claim === claim)
    ?.findings.map((finding) => finding.message) ?? [];

describe("an export that exists only for its test", () => {
  it("reports a value nothing outside the tests uses", () => {
    expect(messagesFor(TEST_ONLY)).toEqual(["exports ONLY_A_TEST_READS_THIS, which only tests use"]);
  });

  it("says nothing about a value production also uses", () => {
    expect(messagesFor(TEST_ONLY).join()).not.toContain("usedInProduction");
  });

  it("counts a consumer in the declaring zone, which crosses no boundary to be seen", () => {
    expect(messagesFor(TEST_ONLY).join()).not.toContain("usedBySibling");
  });

  it("names the fix that would make the codebase worse", () => {
    const claim = sharedReport().claims.find((entry) => entry.claim === TEST_ONLY);
    expect(claim?.guidance).toContain("Adding a production caller to satisfy this check");
  });

  it("stays quiet when no zone is declared as tests", () => {
    const report = check({
      root: SHARED,
      colocation: true,
      zones: [{ name: "all", patterns: ["src/**"] }],
    });

    expect(report.claims.find((entry) => entry.claim === TEST_ONLY)).toBeUndefined();
  });
});

describe("what the shared fixture reports, in full", () => {
  it("reports exactly these misplacements, ordered by the file that declares them", () => {
    expect(messagesFor(CLAIM)).toEqual([
      "declares 2 exports, all used only by src/web/detail.ts, so the file is in the wrong directory rather than the declarations",
      "declares alsoForDetail, used only by src/web/detail.ts",
      "declares forDetail, used only by src/web/detail.ts",
      "declares usedInProduction, used only by src/web/detail.ts",
      "declares forWebOnly, used only by web (2 files)",
    ]);
  });

  it("reports exactly this export as reachable only from a test", () => {
    expect(messagesFor(TEST_ONLY)).toEqual(["exports ONLY_A_TEST_READS_THIS, which only tests use"]);
  });

  it("says nothing about a type only one zone names, which can be used without importing it", () => {
    expect(messagesFor(CLAIM).join()).not.toContain("OnlyWebNamesThis");
  });

  it("says nothing about an import that resolves to no file of ours", () => {
    expect(messagesFor(CLAIM).join()).not.toContain("sep");
  });

  it("says nothing about a value used only inside the zone that declares it", () => {
    expect(messagesFor(CLAIM).join()).not.toContain("usedBySibling");
  });

  it("says nothing about a helper the tests declare for themselves", () => {
    expect(messagesFor(TEST_ONLY).join()).not.toContain("specHelper");
  });

  it("says nothing about a published export, whose consumers it cannot see", () => {
    expect(messagesFor(TEST_ONLY).join()).not.toContain("publishedThing");
  });
});

describe("showing a misplaced file rather than a scatter of symbols", () => {
  const next = (): string => renderNext(sharedReport(), SHARED);

  it("holds off calling a file misplaced while its own zone still reads it, since that move breaks", () => {
    const about = messagesFor(CLAIM).filter((message) => message.toLowerCase().includes("fordetail"));

    expect(about).toEqual([
      "declares alsoForDetail, used only by src/web/detail.ts",
      "declares forDetail, used only by src/web/detail.ts",
    ]);
  });

  it("states the move, rather than listing the symbols and leaving the reader to draw it", () => {
    expect(next()).toContain("no-value-is-declared-away-from-its-only-consumer  1 error");
    expect(next()).toContain(
      "declares 2 exports, all used only by src/web/detail.ts, so the file is in the wrong directory",
    );
  });

  it("counts a file as one problem, not one per symbol it declares", () => {
    expect(next().split("\n")[0]).toContain("problem 1 of 5 · 13 claims · 6 errors");
  });

  it("keeps two files apart, since only one of them can be the misplaced one", () => {
    expect(next()).not.toContain("usedInProduction");
  });
});

describe("an edge with a file outside every zone at one end", () => {
  const UNZONED = fixtureAt("unzoned");

  const misplacements = (): readonly string[] =>
    claimIn(
      check({
        root: UNZONED,
        colocation: true,
        zones: [
          { name: "core", patterns: ["src/core/**"] },
          { name: "web", patterns: ["src/web/**"] },
        ],
      }),
      CLAIM,
    )?.findings.map((finding) => finding.message) ?? [];

  it("reports only the crossing where both ends have a zone to compare", () => {
    expect(misplacements()).toEqual(["declares onlyWebUses, used only by src/web/page.ts"]);
  });
});

describe("a shared zone that is not actually shared", () => {
  it("counts the files in the owning zone rather than naming one of them", () => {
    expect(messagesFor(CLAIM)).toContain("declares forWebOnly, used only by web (2 files)");
  });

  it("says nothing about a value two zones genuinely share", () => {
    expect(messagesFor(CLAIM).join()).not.toContain("forBoth");
  });
});
