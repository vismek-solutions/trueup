import { describe, expect, it } from "vitest";
import { applyBaseline } from "../../src/ratchet/apply.ts";
import type { Finding } from "../../src/report/model.ts";
import { error, reportOf } from "../support/sample-report.ts";

const ROOT = "/p";
const CLAIM = "a-mixed-claim";
const OLD_WORDS = "the old words";

const RECORDED = {
  entries: [
    { claim: CLAIM, file: "a.ts", message: OLD_WORDS },
    { claim: CLAIM, file: "a.ts", message: "another phrasing of the same thing" },
  ],
};

const ruledOn = (claim: string, findings: readonly Finding[]): readonly Finding[] => {
  const report = reportOf([{ claim, guidance: "never shown", findings }]);
  const { report: effective } = applyBaseline({ report, baseline: RECORDED, root: ROOT });

  return effective.claims[0]?.findings ?? [];
};

describe("a finding standing where a baseline entry has just gone stale", () => {
  it("is marked, so the guard can tell it from one the edit introduced", () => {
    expect(ruledOn(CLAIM, [error("the new words", "/p/a.ts")])[0]?.reworded).toBe(true);
  });

  it("is left alone on another file, since a stale entry names the one file it came from", () => {
    expect(ruledOn(CLAIM, [error("the new words", "/p/b.ts")])[0]?.reworded).toBeUndefined();
  });

  it("is left alone under another claim, since that claim retired nothing", () => {
    expect(ruledOn("a-warning-claim", [error("the new words", "/p/a.ts")])[0]?.reworded).toBeUndefined();
  });

  it("is left alone when the baseline still holds it, since nothing about it was re-worded", () => {
    expect(ruledOn(CLAIM, [error(OLD_WORDS, "/p/a.ts")])[0]?.reworded).toBeUndefined();
  });
});
