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

const runWith = (zones: readonly ZoneDefinition[] = ZONES, colocation = true): Promise<Report> =>
  check({ root: ROOT, zones, colocation });

describe("keeping a value with its only consumer", () => {
  it("stays quiet until switched on", async () => {
    expect(claimIn(await check({ root: ROOT, zones: ZONES }), CLAIM)).toBeUndefined();
  });

  it("names the declaring file and the one file that uses it", async () => {
    const findings = claimIn(await runWith(), CLAIM)?.findings ?? [];

    expect(findings).toHaveLength(1);
    expect(findings[0]?.file).toBe(join(ROOT, "src/domain/thing.ts"));
    expect(findings[0]?.message).toContain("used only by src/engine/runner.ts");
  });

  it("says nothing when the consuming zone never owns what it uses", async () => {
    const zones: readonly ZoneDefinition[] = [
      { name: "engine", patterns: ["src/engine/**"], role: "wiring" },
      { name: "domain", patterns: ["src/domain/**"] },
    ];

    expect(claimIn(await runWith(zones), CLAIM)?.findings).toEqual([]);
  });

  it("tells the reader when a shared package is right even though the finding stands", async () => {
    expect(claimIn(await runWith(), CLAIM)?.guidance).toContain(
      "Reach for the shared home anyway when the consumer named must not own the value",
    );
  });

  it("tells the reader when giving a zone a role is honest", async () => {
    expect(claimIn(await runWith(), CLAIM)?.guidance).toContain("never owns what it uses");
  });

  it("names the thing to move from the shape of the finding, rather than sending the reader to the file", async () => {
    const guidance = claimIn(await runWith(), CLAIM)?.guidance ?? "";

    expect(guidance).toContain("The shape of the finding decides what moves");
    expect(guidance).toContain("`declares <name>, used only by ...`");
  });

  it("leaves out the branches for shapes it did not report", async () => {
    const guidance = claimIn(await runWith(), CLAIM)?.guidance ?? "";

    expect(guidance).not.toContain("`declares N exports, all used only by ...`");
    expect(guidance).not.toContain("`declares <name>, used outside its zone only by ...`");
    expect(guidance).not.toContain("`... and by this file as well`");
    expect(guidance).not.toContain("reads it too but is <role>");
    expect(guidance).not.toContain("A type is never reported");
  });
});

const SHARED = fixtureAt("colocated");
const TEST_ONLY = "no-export-exists-only-for-a-test";

const sharedReport = (): Promise<Report> =>
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

const messagesFor = async (claim: string): Promise<readonly string[]> =>
  (await sharedReport()).claims
    .find((entry) => entry.claim === claim)
    ?.findings.map((finding) => finding.message) ?? [];

describe("an export that exists only for its test", () => {
  it("reports a value nothing outside the tests uses", async () => {
    expect(await messagesFor(TEST_ONLY)).toEqual(["exports ONLY_A_TEST_READS_THIS, which only tests use"]);
  });

  it("says nothing about a value production also uses", async () => {
    expect((await messagesFor(TEST_ONLY)).join()).not.toContain("usedInProduction");
  });

  it("counts a consumer in the declaring zone, which crosses no boundary to be seen", async () => {
    expect((await messagesFor(TEST_ONLY)).join()).not.toContain("usedBySibling");
  });

  it("names the fix that would make the codebase worse", async () => {
    const claim = (await sharedReport()).claims.find((entry) => entry.claim === TEST_ONLY);
    expect(claim?.guidance).toContain(
      "Not the fix: adding a production caller so the export has a real consumer",
    );
  });

  it("stays quiet when no zone is declared as tests", async () => {
    const report = await check({
      root: SHARED,
      colocation: true,
      zones: [{ name: "all", patterns: ["src/**"] }],
    });

    expect(report.claims.find((entry) => entry.claim === TEST_ONLY)).toBeUndefined();
  });
});

describe("an export reached by a lazy import", () => {
  const lazyReport = (): Promise<Report> =>
    check({
      root: fixtureAt("lazy-reader"),
      colocation: true,
      zones: [
        { name: "spec", patterns: ["src/spec/**"], role: "tests" },
        { name: "app", patterns: ["src/app/**"] },
        { name: "view", patterns: ["src/view/**"] },
      ],
    });

  it("is not an export only tests use, since production reaches the module it sits in", async () => {
    expect(claimIn(await lazyReport(), TEST_ONLY)?.findings).toEqual([]);
  });
});

describe("what the shared fixture reports, in full", () => {
  it("carries a branch for every shape standing in the report", async () => {
    const guidance = claimIn(await sharedReport(), CLAIM)?.guidance ?? "";

    expect(guidance).toContain("`declares N exports, all used only by ...`");
    expect(guidance).toContain("`declares <name>, used only by ...`");
    expect(guidance).toContain("`declares <name>, used outside its zone only by ...`");
    expect(guidance).toContain("`... and by this file as well`");
    expect(guidance).toContain("A list under the finding names what each reader imports");
    expect(guidance).toContain("Moving the declaration anywhere but into the consumer named closes nothing");
    expect(guidance).toContain("A type is never reported");
  });

  it("reports exactly these misplacements, ordered by the file that declares them", async () => {
    expect(await messagesFor(CLAIM)).toEqual([
      "declares 2 exports, all used only by src/web/detail.ts, so the file is in the wrong directory rather than the declarations",
      "declares alsoForDetail, used only by src/web/detail.ts",
      "declares forDetail, used only by src/web/detail.ts",
      "declares readBothWays, used outside its zone only by src/web/detail.ts, and inside its zone as well",
      "declares pickedApart, used outside its zone only by src/web/detail.ts, and inside its zone and by this file as well",
      "declares bothAndHome, used outside its zone only by src/web/detail.ts, and inside its zone and by this file as well",
      "declares alsoOnlyServerUses, used only by src/server/handler.ts",
      "declares shapeOnlyServerUses, used only by src/server/handler.ts",
      `declares shapeReachedTwoWays, used only by server (2 files), and by this file as well:
- shapeReachedTwoWays in src/server/handler.ts
- ReachedTwoWays in src/server/route.ts`,
      "declares wrapsAlone, used only by src/server/handler.ts",
      "declares aloneAtHome, used only by src/web/detail.ts, and by this file as well",
      "declares usedInProduction, used only by src/web/detail.ts, while spec reads it too but is tests, so it does not count",
      "declares forWebOnly, used only by web (2 files)",
    ]);
  });

  it("reports exactly this export as reachable only from a test", async () => {
    expect(await messagesFor(TEST_ONLY)).toEqual(["exports ONLY_A_TEST_READS_THIS, which only tests use"]);
  });

  it("says nothing about a type only one zone names, which can be used without importing it", async () => {
    expect((await messagesFor(CLAIM)).join()).not.toContain("OnlyWebNamesThis");
  });

  it("says nothing about an import that resolves to no file of ours", async () => {
    expect((await messagesFor(CLAIM)).join()).not.toContain("sep");
  });

  it("says nothing about a value used only inside the zone that declares it", async () => {
    expect((await messagesFor(CLAIM)).join()).not.toContain("usedBySibling");
  });

  it("says nothing about a helper the tests declare for themselves", async () => {
    expect((await messagesFor(TEST_ONLY)).join()).not.toContain("specHelper");
  });

  it("says nothing about a published export, whose consumers it cannot see", async () => {
    expect((await messagesFor(TEST_ONLY)).join()).not.toContain("publishedThing");
  });
});

describe("a value a foreign zone reads only through the type built from it", () => {
  it("counts that zone as a consumer, since the type cannot be declared where the value is not", async () => {
    expect((await messagesFor(CLAIM)).join()).not.toContain("shapeTheWebNames");
  });

  it("still reports a sibling that type does not name, so the count reaches only what it is built from", async () => {
    expect(await messagesFor(CLAIM)).toContain(
      "declares shapeOnlyServerUses, used only by src/server/handler.ts",
    );
  });

  it("holds off calling the whole file misplaced, since the move would strand that zone's type", async () => {
    expect((await messagesFor(CLAIM)).join()).not.toContain("all used only by src/server/handler.ts");
  });

  it("names what each reader imports, so a count carrying a type holder can be checked by hand", async () => {
    expect(await messagesFor(CLAIM)).toContain(
      `declares shapeReachedTwoWays, used only by server (2 files), and by this file as well:
- shapeReachedTwoWays in src/server/handler.ts
- ReachedTwoWays in src/server/route.ts`,
    );
  });

  it("leaves the count bare when every reader imports the value by its own name", async () => {
    expect(await messagesFor(CLAIM)).toContain(
      "declares alsoOnlyServerUses, used only by src/server/handler.ts",
    );
  });
});

describe("showing a misplaced file rather than a scatter of symbols", () => {
  const next = async (): Promise<string> => renderNext(await sharedReport(), SHARED);

  it("holds off calling a file misplaced while its own zone still reads it, since that move breaks", async () => {
    const about = (await messagesFor(CLAIM)).filter((message) => message.toLowerCase().includes("fordetail"));

    expect(about).toEqual([
      "declares alsoForDetail, used only by src/web/detail.ts",
      "declares forDetail, used only by src/web/detail.ts",
    ]);
  });

  it("says a declaration its own file reads is no free move, since that file would import it back", async () => {
    const about = (await messagesFor(CLAIM)).filter((message) => message.includes("aloneAtHome"));

    expect(about).toEqual(["declares aloneAtHome, used only by src/web/detail.ts, and by this file as well"]);
  });

  it("says the zone reads it too when the only reader at home reaches it through a sibling", async () => {
    const about = (await messagesFor(CLAIM)).filter((message) => message.includes("pickedApart"));

    expect(about).toEqual([
      "declares pickedApart, used outside its zone only by src/web/detail.ts, and inside its zone and by this file as well",
    ]);
  });

  it("carries both home readers where both are real, rather than naming the stronger one alone", async () => {
    const about = (await messagesFor(CLAIM)).filter((message) => message.includes("bothAndHome"));

    expect(about).toEqual([
      "declares bothAndHome, used outside its zone only by src/web/detail.ts, and inside its zone and by this file as well",
    ]);
  });

  it("says a declaration its own zone reads is no free move, rather than naming one consumer", async () => {
    const about = (await messagesFor(CLAIM)).filter((message) => message.includes("readBothWays"));

    expect(about).toEqual([
      "declares readBothWays, used outside its zone only by src/web/detail.ts, and inside its zone as well",
    ]);
  });

  it("names a reader silenced by its role, since no move elsewhere makes such a reader count", async () => {
    const about = (await messagesFor(CLAIM)).filter((message) => message.includes("usedInProduction"));

    expect(about).toEqual([
      "declares usedInProduction, used only by src/web/detail.ts, while spec reads it too but is tests, so it does not count",
    ]);
  });

  it("states the move, rather than listing the symbols and leaving the reader to draw it", async () => {
    expect(await next()).toContain("no-value-is-declared-away-from-its-only-consumer  1 error");
    expect(await next()).toContain(
      "declares 2 exports, all used only by src/web/detail.ts, so the file is in the wrong directory",
    );
  });

  it("counts a file as one problem, not one per symbol it declares", async () => {
    expect((await next()).split("\n")[0]).toContain("problem 1 of 10 · 11 claims · 14 errors");
  });

  it("keeps two files apart, since only one of them can be the misplaced one", async () => {
    expect(await next()).not.toContain("usedInProduction");
  });
});

describe("an edge with a file outside every zone at one end", () => {
  const UNZONED = fixtureAt("unzoned");

  const misplacements = async (): Promise<readonly string[]> =>
    claimIn(
      await check({
        root: UNZONED,
        colocation: true,
        zones: [
          { name: "core", patterns: ["src/core/**"] },
          { name: "web", patterns: ["src/web/**"] },
        ],
      }),
      CLAIM,
    )?.findings.map((finding) => finding.message) ?? [];

  it("reports only the crossing where both ends have a zone to compare", async () => {
    expect(await misplacements()).toEqual(["declares onlyWebUses, used only by src/web/page.ts"]);
  });
});

describe("a shared zone that is not actually shared", () => {
  it("counts the files in the owning zone rather than naming one of them", async () => {
    expect(await messagesFor(CLAIM)).toContain("declares forWebOnly, used only by web (2 files)");
  });

  it("says nothing about a value two zones genuinely share", async () => {
    expect((await messagesFor(CLAIM)).join()).not.toContain("forBoth");
  });
});
