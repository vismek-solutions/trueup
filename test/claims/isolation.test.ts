import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { IsolationRule } from "../../src/claims/isolation.ts";
import { check } from "../../src/compose.ts";
import type { Finding, Report } from "../../src/report/model.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "routes");
const CLAIM = "no-sibling-directory-reaches-another";

const runWith = (...isolate: IsolationRule[]): Report =>
  check({
    root: ROOT,
    zones: [{ name: "app", patterns: ["src/**"] }],
    ...(isolate.length === 0 ? {} : { isolate }),
  });

const findingsIn = (report: Report): readonly Finding[] =>
  report.claims.find((claim) => claim.claim === CLAIM)?.findings ?? [];

const messages = (report: Report): string[] => findingsIn(report).map((finding) => finding.message);

describe("keeping sibling directories apart", () => {
  it("says nothing until a group is declared", () => {
    expect(runWith().claims.find((claim) => claim.claim === CLAIM)).toBeUndefined();
  });

  it("reports one sibling reaching another", () => {
    expect(messages(runWith({ siblings: "src/routes/*" }))).toContain(
      "is a and may not reach sibling b: thing from src/routes/b/thing.ts",
    );
  });

  it("names the file that reached, not the one that was reached", () => {
    const finding = findingsIn(runWith({ siblings: "src/routes/*" }))[0];
    expect(finding?.file).toBe(join(ROOT, "src/routes/a/page.ts"));
  });

  it("groups a file by its top directory however deep it sits", () => {
    expect(messages(runWith({ siblings: "src/routes/*" }))).toContain(
      "is c and may not reach sibling b: thing from src/routes/b/thing.ts",
    );
  });

  it("leaves the parent alone, since it belongs to no sibling", () => {
    const reached = messages(runWith({ siblings: "src/routes/*" }));
    expect(reached.some((message) => message.includes("routes/index.ts"))).toBe(false);
  });

  it("exempts a directory everyone is meant to share", () => {
    const shared = messages(runWith({ siblings: "src/routes/*", except: ["_shared"] }));

    expect(shared.some((message) => message.includes("_shared"))).toBe(false);
    expect(messages(runWith({ siblings: "src/routes/*" })).some((m) => m.includes("_shared"))).toBe(true);
  });

  it("treats each combination of wildcards as its own island", () => {
    expect(messages(runWith({ siblings: "src/*/*" }))).toContain(
      "is routes/a and may not reach sibling routes/b: thing from src/routes/b/thing.ts",
    );
  });

  it("fails rather than passing quietly when the pattern matches no directory", () => {
    expect(messages(runWith({ siblings: "src/pages/*" }))).toEqual([
      "`src/pages/*` matches no directory, so nothing is being kept apart",
    ]);
  });

  it("tells the reader that widening the exception is not the fix", () => {
    const claim = runWith({ siblings: "src/routes/*" }).claims.find((entry) => entry.claim === CLAIM);
    expect(claim?.guidance).toContain("is not the fix");
  });
});
