import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { findingsIn, messagesIn } from "../support/report.ts";
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

  it("leaves the parent alone, since it belongs to no sibling", () => {
    const reached = messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM);
    expect(reached.some((message) => message.includes("routes/index.ts"))).toBe(false);
  });

  it("exempts a directory everyone is meant to share", () => {
    const shared = messagesIn(runWith({ siblings: "src/routes/*", except: ["_shared"] }), CLAIM);

    expect(shared.some((message) => message.includes("_shared"))).toBe(false);
    expect(messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM).some((m) => m.includes("_shared"))).toBe(
      true,
    );
  });

  it("treats each combination of wildcards as its own island", () => {
    expect(messagesIn(runWith({ siblings: "src/*/*" }), CLAIM)).toContain(
      "is routes/a and may not reach sibling routes/b: thing from src/routes/b/thing.ts",
    );
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

  it("tells the reader that widening the exception is not the fix", () => {
    const claim = runWith({ siblings: "src/routes/*" }).claims.find((entry) => entry.claim === CLAIM);
    expect(claim?.guidance).toContain("is not the fix");
  });
});
