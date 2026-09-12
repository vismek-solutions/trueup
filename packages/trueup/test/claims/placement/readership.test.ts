import { describe, expect, it } from "vitest";
import { fixtureAt } from "../../support/fixtures.ts";
import { claimIn, findingsIn, messagesIn } from "../../support/report.ts";
import { check } from "../../../src/compose.ts";
import type { ZoneDefinition } from "../../../src/zones/model.ts";
import type { Report } from "../../../src/report/model.ts";

const ROOT = fixtureAt("readerships");
const CLAIM = "no-file-serves-two-readerships";

const listing = (head: string, ...parts: readonly string[]): string =>
  [head, ...parts.map((part) => `- ${part}`)].join("\n");

const TWO = "serves 2 readerships that never meet:";

const PAIR = listing(TWO, "first from src/reader", "second from src/writer");
const THREE = listing(TWO, "alpha, omega from src/reader", "middle from src/writer");
const JOBS = listing(TWO, "parse from ., src/both, src/reader, src/reader-web", "render from src/writer");
const FOUND_BACKWARDS = listing(TWO, "ant from src/writer", "zebra from src/reader");
const ANCHORED = listing(
  "serves 2 readerships that never meet, and only label can leave without taking anything else with it:",
  "label from src/writer",
  "lookUp from src/reader",
);

const ZONES: readonly ZoneDefinition[] = [
  { name: "shared", patterns: ["src/shared/**"] },
  { name: "reader", patterns: ["src/reader/**"] },
  { name: "writer", patterns: ["src/writer/**"] },
  { name: "both", patterns: ["src/both/**"] },
  { name: "surface", patterns: ["src/api/**"], role: "api" },
  { name: "root", patterns: ["src/main.ts"], role: "wiring" },
];

const runWith = (zones: readonly ZoneDefinition[] = ZONES, readerships = true): Promise<Report> =>
  check({ root: ROOT, zones, readerships });

const stripped = (name: string): readonly ZoneDefinition[] =>
  ZONES.map((zone) => (zone.name === name ? { name: zone.name, patterns: zone.patterns } : zone));

const said = async (): Promise<readonly string[]> => messagesIn(await runWith(), CLAIM);

describe("a file serving readerships that never meet", () => {
  it("reports each one, in a settled order, naming every group and where it is read from", async () => {
    expect(await said()).toEqual([ANCHORED, PAIR, THREE, JOBS, FOUND_BACKWARDS]);
  });

  it("names the groups in one order however they were found, so the message cannot churn", async () => {
    expect(await said()).toContain(FOUND_BACKWARDS);
  });

  it("reports it as an error rather than something to look at later", async () => {
    expect(findingsIn(await runWith(), CLAIM)[0]?.severity).toBe("error");
  });

  it("finds an export declared by taking a record apart, not only one written out", async () => {
    expect(await said()).toContain(PAIR);
  });

  it("leaves out an export nothing reads, rather than counting it as a group of its own", async () => {
    expect((await said()).join()).not.toContain("spare");
  });

  it("does not count a whole-module import as a group, since it names no one export", async () => {
    expect(await said()).toContain(JOBS);
  });

  it("names a reader sitting at the root of the tree, which has no path to show", async () => {
    expect((await said()).join()).toContain("from .,");
  });

  it("counts a reader in no zone at all, since only a role says a reader does not count", async () => {
    expect((await said()).join()).toContain("src/reader-web");
  });
});

describe("what holds two exports together", () => {
  it("counts a declaration that names a sibling with that sibling", async () => {
    expect((await said()).join()).not.toContain("RowKey");
  });

  it("does not join two exports because a string in one spells the other", async () => {
    expect(await said()).toContain(THREE);
  });

  it("joins a chain of exports through the one in the middle, not only its ends", async () => {
    expect((await said()).join()).not.toContain("middleLink");
  });

  it("joins nothing on a name used outside every declaration in the file", async () => {
    expect(await said()).toContain(THREE);
  });

  it("says nothing about a file whose readers overlap", async () => {
    expect((await said()).join()).not.toContain("north");
  });
});

describe("who does not count as a reader", () => {
  it("leaves a zone with the api role alone, since its readers are outside the analysis", async () => {
    expect((await said()).join()).not.toContain("left");
  });

  it("does not count a composition root, which would join every group it wires", async () => {
    expect(messagesIn(await runWith(stripped("root")), CLAIM)).toEqual([
      ANCHORED,
      PAIR,
      THREE,
      FOUND_BACKWARDS,
    ]);
  });

  it("does not count an import of something declared outside the analysis", async () => {
    expect((await said()).join()).not.toContain("dirname");
  });
});

describe("switching it on", () => {
  it("says nothing at all until it is asked for", async () => {
    expect(claimIn(await runWith(ZONES, false), CLAIM)).toBeUndefined();
  });

  it("names dissolving the group as the answer, and rehousing it as the mistake", async () => {
    expect(claimIn(await runWith(), CLAIM)?.guidance).toContain("dissolve it rather than rehousing it");
  });

  it("sends the reader to the named part rather than back to the file", async () => {
    expect(claimIn(await runWith(), CLAIM)?.guidance).toContain(
      "Move that one, and opening the file will not give you a better answer",
    );
  });
});
