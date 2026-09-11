import { describe, expect, it } from "vitest";
import { fixtureAt } from "../../support/fixtures.ts";
import { claimIn, findingsIn, messagesIn } from "../../support/report.ts";
import { check } from "../../../src/compose.ts";
import type { ZoneDefinition } from "../../../src/zones/model.ts";
import type { Report } from "../../../src/report/model.ts";

const ROOT = fixtureAt("readerships");
const CLAIM = "no-file-serves-two-readerships";

const PAIR = "serves 2 readerships that never meet: first from src/reader; second from src/writer";
const THREE = "serves 2 readerships that never meet: alpha, omega from src/reader; middle from src/writer";
const JOBS =
  "serves 2 readerships that never meet: parse from ., src/both, src/reader, src/reader-web;" +
  " render from src/writer";
const FOUND_BACKWARDS = "serves 2 readerships that never meet: ant from src/writer; zebra from src/reader";
const ANCHORED =
  "serves 2 readerships that never meet, and only label can leave without taking anything else" +
  " with it: label from src/writer; lookUp from src/reader";

const ZONES: readonly ZoneDefinition[] = [
  { name: "shared", patterns: ["src/shared/**"] },
  { name: "reader", patterns: ["src/reader/**"] },
  { name: "writer", patterns: ["src/writer/**"] },
  { name: "both", patterns: ["src/both/**"] },
  { name: "surface", patterns: ["src/api/**"], role: "api" },
  { name: "root", patterns: ["src/main.ts"], role: "wiring" },
];

const runWith = (zones: readonly ZoneDefinition[] = ZONES, readerships = true): Report =>
  check({ root: ROOT, zones, readerships });

const stripped = (name: string): readonly ZoneDefinition[] =>
  ZONES.map((zone) => (zone.name === name ? { name: zone.name, patterns: zone.patterns } : zone));

const said = (): readonly string[] => messagesIn(runWith(), CLAIM);

describe("a file serving readerships that never meet", () => {
  it("reports each one, in a settled order, naming every group and where it is read from", () => {
    expect(said()).toEqual([ANCHORED, PAIR, THREE, JOBS, FOUND_BACKWARDS]);
  });

  it("names the groups in one order however they were found, so the message cannot churn", () => {
    expect(said()).toContain(FOUND_BACKWARDS);
  });

  it("reports it as an error rather than something to look at later", () => {
    expect(findingsIn(runWith(), CLAIM)[0]?.severity).toBe("error");
  });

  it("finds an export declared by taking a record apart, not only one written out", () => {
    expect(said()).toContain(PAIR);
  });

  it("leaves out an export nothing reads, rather than counting it as a group of its own", () => {
    expect(said().join()).not.toContain("spare");
  });

  it("does not count a whole-module import as a group, since it names no one export", () => {
    expect(said()).toContain(JOBS);
  });

  it("names a reader sitting at the root of the tree, which has no path to show", () => {
    expect(said().join()).toContain("from .,");
  });

  it("counts a reader in no zone at all, since only a role says a reader does not count", () => {
    expect(said().join()).toContain("src/reader-web");
  });
});

describe("what holds two exports together", () => {
  it("counts a declaration that names a sibling with that sibling", () => {
    expect(said().join()).not.toContain("RowKey");
  });

  it("does not join two exports because a string in one spells the other", () => {
    expect(said()).toContain(THREE);
  });

  it("joins a chain of exports through the one in the middle, not only its ends", () => {
    expect(said().join()).not.toContain("middleLink");
  });

  it("joins nothing on a name used outside every declaration in the file", () => {
    expect(said()).toContain(THREE);
  });

  it("says nothing about a file whose readers overlap", () => {
    expect(said().join()).not.toContain("north");
  });
});

describe("who does not count as a reader", () => {
  it("leaves a zone with the api role alone, since its readers are outside the analysis", () => {
    expect(said().join()).not.toContain("left");
  });

  it("does not count a composition root, which would join every group it wires", () => {
    expect(messagesIn(runWith(stripped("root")), CLAIM)).toEqual([
      ANCHORED,
      PAIR,
      THREE,
      FOUND_BACKWARDS,
    ]);
  });

  it("does not count an import of something declared outside the analysis", () => {
    expect(said().join()).not.toContain("dirname");
  });
});

describe("switching it on", () => {
  it("says nothing at all until it is asked for", () => {
    expect(claimIn(runWith(ZONES, false), CLAIM)).toBeUndefined();
  });

  it("names dissolving the group as the answer, and rehousing it as the mistake", () => {
    expect(claimIn(runWith(), CLAIM)?.guidance).toContain("dissolving it usually beats rehousing it");
  });

  it("sends the reader to the named part rather than back to the file", () => {
    expect(claimIn(runWith(), CLAIM)?.guidance).toContain(
      "that part is the one to move, and opening the file will not give you a better answer",
    );
  });
});
