import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { findingsIn, messagesIn, reportForConfig } from "../support/report.ts";
import type { IsolationRule } from "../../src/claims/isolation.ts";
import { check } from "../../src/compose.ts";
import type { Report } from "../../src/report/model.ts";

const ROOT = fixtureAt("routes");
const CLAIM = "no-sibling-directory-reaches-another";

const runWith = (...isolate: IsolationRule[]): Report =>
  check({
    root: ROOT,
    zones: [{ name: "app", patterns: ["src/**"] }],
    ...(isolate.length === 0 ? {} : { isolate }),
  });

describe("keeping sibling directories apart", () => {
  it("says nothing until a group is declared", () => {
    expect(runWith().claims.find((claim) => claim.claim === CLAIM)).toBeUndefined();
  });

  it("reports one sibling reaching another", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM)).toContain(
      "is a and may not reach sibling b: thing from src/routes/b/thing.ts",
    );
  });

  it("names the file that reached, not the one that was reached", () => {
    const finding = findingsIn(runWith({ siblings: "src/routes/*" }), CLAIM)[0];
    expect(finding?.file).toBe(join(ROOT, "src/routes/a/page.ts"));
  });

  it("groups a file by its top directory however deep it sits", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM)).toContain(
      "is c and may not reach sibling b: thing from src/routes/b/thing.ts",
    );
  });

  it("warns rather than passing quietly when the pattern finds only one sibling", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/c/*" }), CLAIM)).toEqual([
      "`src/routes/c/*` matches only deep, so it is keeping nothing apart yet",
    ]);
  });

  it("keeps that a warning, since a second sibling may simply not exist yet", () => {
    const findings = findingsIn(runWith({ siblings: "src/routes/c/*" }), CLAIM);

    expect(findings.map((finding) => finding.severity)).toEqual(["warning"]);
  });

  it("warns the same way for a pattern reaching a level deeper than the tree goes", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*/*" }), CLAIM)).toEqual([
      "`src/routes/*/*` matches only c/deep, so it is keeping nothing apart yet",
    ]);
  });

  it("drops the warning once there are siblings to keep apart", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM).join()).not.toContain(
      "keeping nothing apart",
    );
  });

  it("fails loudly for a pattern with no wildcard, rather than making one group of everything", () => {
    expect(messagesIn(runWith({ siblings: "src/routes" }), CLAIM)).toEqual([
      "`src/routes` matches no directory, so nothing is being kept apart",
    ]);
  });

  it("names a group by its own directory when a globstar above it matched nothing", () => {
    expect(messagesIn(runWith({ siblings: "src/**/routes/*" }), CLAIM)).toEqual([
      "is a and may not reach sibling .internal: hidden from src/routes/.internal/hidden.ts",
      "is a and may not reach sibling b: thing from src/routes/b/thing.ts",
      "is a and may not reach sibling _shared: util from src/routes/_shared/util.ts",
      "is c and may not reach sibling b: thing from src/routes/b/thing.ts",
    ]);
  });

  it("says nothing when a grouped file reaches one that belongs to no group", () => {
    const reached = messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM);

    expect(reached.some((message) => message.includes("root-util"))).toBe(false);
  });

  it("says nothing about an import it could not resolve to a file", () => {
    const reached = messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM);

    expect(reached.some((message) => message.includes("node:path"))).toBe(false);
  });

  it("reports these crossings and no others, so a lost or invented one is a failure", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM)).toEqual([
      "is a and may not reach sibling .internal: hidden from src/routes/.internal/hidden.ts",
      "is a and may not reach sibling b: thing from src/routes/b/thing.ts",
      "is a and may not reach sibling _shared: util from src/routes/_shared/util.ts",
      "is c and may not reach sibling b: thing from src/routes/b/thing.ts",
    ]);
  });

  it("leaves a file at the parent ungrouped, so it is neither offender nor target", () => {
    const reached = messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM);

    expect(reached.some((message) => message.startsWith("is index.ts"))).toBe(false);
    expect(reached.some((message) => message.includes("routes/index.ts"))).toBe(false);
  });

  it("says nothing about a file reaching its own group, which is the whole point of a group", () => {
    const reached = messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM);

    expect(reached.some((message) => message.includes("helper"))).toBe(false);
  });

  it("keeps a dot-prefixed directory apart like any other, rather than overlooking it", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM)).toContain(
      "is a and may not reach sibling .internal: hidden from src/routes/.internal/hidden.ts",
    );
  });

  it("reports a crossing as an error, not a warning", () => {
    const severities = findingsIn(runWith({ siblings: "src/routes/*" }), CLAIM).map(
      (finding) => finding.severity,
    );

    expect(new Set(severities)).toEqual(new Set(["error"]));
  });

  it("fails as an error too when the pattern matches nothing", () => {
    expect(findingsIn(runWith({ siblings: "src/pages/*" }), CLAIM)[0]?.severity).toBe("error");
  });

  it("exempts a directory everyone is meant to share", () => {
    const shared = messagesIn(runWith({ siblings: "src/routes/*", except: ["_shared"] }), CLAIM);

    expect(shared.some((message) => message.includes("_shared"))).toBe(false);
    expect(messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM).some((m) => m.includes("_shared"))).toBe(
      true,
    );
  });

  it("treats each combination of wildcards as its own island, and groups nothing shallower", () => {
    expect(messagesIn(runWith({ siblings: "src/*/*" }), CLAIM)).toEqual([
      "is routes/a and may not reach sibling routes/.internal: hidden from src/routes/.internal/hidden.ts",
      "is routes/a and may not reach sibling routes/b: thing from src/routes/b/thing.ts",
      "is routes/a and may not reach sibling routes/_shared: util from src/routes/_shared/util.ts",
      "is routes/c and may not reach sibling routes/b: thing from src/routes/b/thing.ts",
    ]);
  });

  it("keeps the same route name in two apps apart, and each app's routes from each other", () => {
    const root = fixtureAt("many-routes");
    const report = check({
      root,
      zones: [{ name: "apps", patterns: ["apps/**"] }],
      isolate: [{ siblings: "apps/*/src/routes/*" }],
    });

    expect(messagesIn(report, "every-import-resolves")).toEqual([]);
    expect(messagesIn(report, CLAIM)).toEqual([
      "is ui/a and may not reach sibling ui/b: thing from apps/ui/src/routes/b/thing.ts",
      "is web/a and may not reach sibling ui/a: page from apps/ui/src/routes/a/page.ts",
    ]);
  });

  it("fails rather than passing quietly when the pattern matches no directory", () => {
    expect(messagesIn(runWith({ siblings: "src/pages/*" }), CLAIM)).toEqual([
      "`src/pages/*` matches no directory, so nothing is being kept apart",
    ]);
  });

  it("takes the rule from the member that owns the shape, resolved against its directory", async () => {
    const report = await reportForConfig(join(fixtureAt("member-isolate"), "trueup.config.ts"));

    expect(messagesIn(report, CLAIM)).toEqual([
      "is a and may not reach sibling b: thing from apps/web/src/routes/b/thing.ts",
    ]);
  });

  it("reads a member's `except` as the group names its own pattern captures", async () => {
    const report = await reportForConfig(join(fixtureAt("member-isolate"), "trueup.config.ts"));

    expect(messagesIn(report, CLAIM).join()).not.toContain("chrome");
  });

  it("tells the reader that widening the exception is not the fix", () => {
    const claim = runWith({ siblings: "src/routes/*" }).claims.find((entry) => entry.claim === CLAIM);
    expect(claim?.guidance).toContain("is not the fix");
  });
});
