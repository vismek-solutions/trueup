import { describe, expect, it } from "vitest";
import type { ReviewBudget } from "../../../src/claims/review/budget.ts";
import { check } from "../../../src/compose.ts";
import type { ChangeSet, Changes, FileChange } from "../../../src/ports/changes.ts";
import { claimIn, findingsIn, messagesIn } from "../../support/report.ts";
import { fixtureAt } from "../../support/fixtures.ts";

const ROOT = fixtureAt("explained");
const CLAIM = "no-change-outgrows-its-review";

const CAP: ReviewBudget = { additions: 600, deletions: 400 };

const of = (file: string, added: number, removed = 0): FileChange => ({ file, added, removed });

const reading = (changed: ChangeSet): Changes => ({ since: () => changed });

const measured = (...files: readonly FileChange[]): Changes =>
  reading({ kind: "measured", base: "main", files });

const reportOf = (reviewable: ReviewBudget, changes: Changes) =>
  check({ root: ROOT, zones: [], reviewable, changes });

const said = async (reviewable: ReviewBudget, changes: Changes): Promise<readonly string[]> =>
  messagesIn(await reportOf(reviewable, changes), CLAIM);

const severityOf = async (reviewable: ReviewBudget, changes: Changes): Promise<string | undefined> =>
  findingsIn(await reportOf(reviewable, changes), CLAIM)[0]?.severity;

describe("switching the budget on", () => {
  it("says nothing at all until a project sets one", async () => {
    expect(claimIn(await check({ root: ROOT, zones: [] }), CLAIM)).toBeUndefined();
  });

  it("names splitting as the answer, and raising the cap as the mistake", async () => {
    const guidance = claimIn(await reportOf(CAP, measured()), CLAIM)?.guidance ?? "";

    expect(guidance).toContain("Find a seam in what you have already done");
    expect(guidance).toContain("Not the fix: raising the budget because the work is nearly done.");
  });
});

describe("a change that still fits its review", () => {
  it("says nothing while both counts are under the cap", async () => {
    expect(await said(CAP, measured(of("src/one.ts", 599, 399)))).toEqual([]);
  });

  it("says nothing about a change of no size, so a clean tree is quiet", async () => {
    expect(await said(CAP, measured())).toEqual([]);
  });

  it("stays quiet at exactly the cap, which is what the cap allows", async () => {
    expect(await said(CAP, measured(of("src/one.ts", 600, 400)))).toEqual([]);
  });
});

describe("a change too large to review", () => {
  it("counts additions and deletions apart, since a deletion is cheaper to read", async () => {
    expect((await said(CAP, measured(of("src/one.ts", 0, 401))))[0]).toContain("+0 / -401");
  });

  it("names the branch it measured against, so the number can be reproduced", async () => {
    expect((await said(CAP, measured(of("src/one.ts", 601))))[0]).toContain("against main");
  });

  it("names the cap it passed rather than only the count", async () => {
    expect((await said(CAP, measured(of("src/one.ts", 601))))[0]).toContain("over the +600 / -400");
  });

  it("names the heaviest files, so a lock file that ate the budget is visible", async () => {
    const changed = measured(of("small.ts", 1), of("pnpm-lock.yaml", 900), of("mid.ts", 50));

    expect((await said(CAP, changed))[0]).toContain(
      "heaviest: pnpm-lock.yaml +900/-0, mid.ts +50/-0, small.ts +1/-0",
    );
  });

  it("names only the heaviest few, so a wide change does not print every file it touched", async () => {
    const changed = measured(
      of("wide.ts", 10, 500),
      of("mid.ts", 200),
      of("small.ts", 100),
      of("tiny.ts", 1),
    );

    expect((await said(CAP, changed))[0]).toContain(
      "heaviest: wide.ts +10/-500, mid.ts +200/-0, small.ts +100/-0",
    );
    expect((await said(CAP, changed))[0]).not.toContain("tiny.ts");
  });

  it("warns rather than failing, so an unattended agent is not stopped mid-change", async () => {
    expect(await severityOf(CAP, measured(of("src/one.ts", 601)))).toBe("warning");
  });

  it("fails instead when the project asked it to", async () => {
    expect(await severityOf({ ...CAP, severity: "error" }, measured(of("src/one.ts", 601)))).toBe("error");
  });
});

describe("a change nearing its cap", () => {
  const NEARING: ReviewBudget = { ...CAP, nearing: 0.8 };

  it("says nothing before the warning band, however close", async () => {
    expect(await said(NEARING, measured(of("src/one.ts", 480)))).toEqual([]);
  });

  it("warns inside the band, in time to pick a seam", async () => {
    expect((await said(NEARING, measured(of("src/one.ts", 481))))[0]).toContain("nearing the +600 / -400");
  });

  it("says nearing rather than over, since nothing has been passed yet", async () => {
    expect((await said(NEARING, measured(of("src/one.ts", 481))))[0]).not.toContain("over the");
  });

  it("warns inside the band on deletions alone, since a large removal is still a large review", async () => {
    expect((await said(NEARING, measured(of("src/one.ts", 0, 321))))[0]).toContain("nearing the +600 / -400");
  });

  it("says nothing at the edge of the deletions band, which is not yet inside it", async () => {
    expect(await said(NEARING, measured(of("src/one.ts", 0, 320)))).toEqual([]);
  });

  it("warns inside the band even where the cap itself would fail", async () => {
    const failing = { ...NEARING, severity: "error" as const };

    expect(await severityOf(failing, measured(of("src/one.ts", 481)))).toBe("warning");
  });

  it("still fails once the cap is passed", async () => {
    const failing = { ...NEARING, severity: "error" as const };

    expect(await severityOf(failing, measured(of("src/one.ts", 601)))).toBe("error");
  });
});

describe("what the budget leaves out", () => {
  const SPARING: ReviewBudget = { ...CAP, except: ["*.lock", "**/generated/**"] };

  it("drops a file the project named, so a generated one cannot eat the budget", async () => {
    expect(await said(SPARING, measured(of("deps.lock", 900)))).toEqual([]);
  });

  it("matches a pattern against the whole path, not only the file name", async () => {
    expect(await said(SPARING, measured(of("src/generated/api.ts", 900)))).toEqual([]);
  });

  it("leaves out a dotted file the project named, since a generated file often carries a dot", async () => {
    expect(await said(SPARING, measured(of(".deps.lock", 900)))).toEqual([]);
  });

  it("keeps counting everything the project did not name", async () => {
    const changed = measured(of("deps.lock", 900), of("src/one.ts", 601));

    expect((await said(SPARING, changed))[0]).toContain("+601 / -0");
  });
});

describe("a change it could not measure", () => {
  const unmeasured = reading({ kind: "unmeasured", reason: "no common commit with main" });

  it("says so rather than passing quietly, since a budget measuring nothing enforces nothing", async () => {
    expect((await said(CAP, unmeasured))[0]).toContain("could not be measured");
  });

  it("repeats what git said, so a shallow clone is recognisable", async () => {
    expect((await said(CAP, unmeasured))[0]).toContain("no common commit with main");
  });

  it("warns rather than failing, since this is the environment and not the change", async () => {
    expect(await severityOf({ ...CAP, severity: "error" }, unmeasured)).toBe("warning");
  });
});
