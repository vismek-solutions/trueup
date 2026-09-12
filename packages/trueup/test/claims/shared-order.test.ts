import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { claimIn, messagesIn, reportForConfig } from "../support/report.ts";
import type { SiblingException } from "../../src/claims/isolation/sharing.ts";
import { check } from "../../src/compose.ts";
import type { Report } from "../../src/report/model.ts";

const LAYERED = fixtureAt("shared-layers");
const CLAIM = "no-sibling-directory-reaches-another";
const ROOT_REFUSED =
  "is _root, shared with reach into `_state` only, and may not reach _ui: kit from src/routes/_ui/kit.ts";
const STATE_REFUSED =
  "is _state, shared with no reach into what else is shared, and may not reach _ui: kit from src/routes/_ui/kit.ts";

const reportWith = (...except: SiblingException[]): Promise<Report> =>
  check({
    root: LAYERED,
    zones: [{ name: "app", patterns: ["src/**"] }],
    isolate: [{ siblings: "src/routes/*", except }],
  });

const layered = async (...except: SiblingException[]): Promise<string[]> =>
  messagesIn(await reportWith(...except), CLAIM);

describe("an order among the directories a group shares", () => {
  it("lets a shared directory reach only the shared siblings its list allows", async () => {
    expect(await layered("_ui", "_state", { shared: "_root", allow: ["_state"] })).toEqual([ROOT_REFUSED]);
  });

  it("says so when a directory was given no reach at all", async () => {
    expect(await layered("_ui", "_root", { shared: "_state", allow: [] })).toEqual([STATE_REFUSED]);
  });

  it("keeps a bare name reaching every shared sibling, as it always has", async () => {
    expect(await layered("_ui", "_state", "_root")).toEqual([]);
  });

  it("still lets an island reach every shared directory, whatever the order among them", async () => {
    const said = await layered("_ui", { shared: "_state", allow: [] }, { shared: "_root", allow: [] });

    expect(said.join()).not.toContain("is a");
  });

  it("reads the allowed reach as patterns, like the names beside it", async () => {
    const said = await layered("_ui", "_state", { shared: "_root", allow: ["_st*"] });

    expect(said.join()).not.toContain("may not reach _state");
    expect(said).toEqual([
      "is _root, shared with reach into `_st*` only, and may not reach _ui: kit from src/routes/_ui/kit.ts",
    ]);
  });

  it("lists every pattern the directory was given, spaced apart rather than run together", async () => {
    expect(await layered("_ui", "_state", { shared: "_root", allow: ["_state", "_kit"] })).toEqual([
      "is _root, shared with reach into `_state` · `_kit` only, and may not reach _ui: kit from src/routes/_ui/kit.ts",
    ]);
  });

  it("takes the first entry that matches, so a wide name after a narrow one does not widen it", async () => {
    expect(await layered({ shared: "_state", allow: [] }, "_*")).toEqual([STATE_REFUSED]);
    expect(await layered("_*", { shared: "_state", allow: [] })).toEqual([]);
  });

  it("reports both shapes together, and nothing else", async () => {
    const report = await reportForConfig(join(LAYERED, "trueup.config.ts"));

    expect(messagesIn(report, CLAIM)).toEqual([ROOT_REFUSED, STATE_REFUSED]);
  });

  it("tells the reader that widening the reach is not the fix", async () => {
    const claim = claimIn(await reportWith(), CLAIM);

    expect(claim?.guidance).toContain("rather than adding the reached directory to `allow`");
  });
});
