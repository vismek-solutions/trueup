import { describe, expect, it } from "vitest";
import { acceptanceOf, applyBaseline, baselineOf } from "../../src/ratchet/apply.ts";
import type { Report } from "../../src/report/model.ts";
import { error, reportOf } from "../support/sample-report.ts";

const ROOT = "/p";
const SAME_WORDS = "runs to 31 words in one sentence, more than the 30 allowed";

const sentences = (count: number): Report =>
  reportOf([
    {
      claim: "no-passage-runs-past-its-limit",
      guidance: "",
      findings: Array.from({ length: count }, () => error(SAME_WORDS, `${ROOT}/a.md`)),
    },
  ]);

const ruledOn = (reported: number, recorded: number) => {
  const ruling = applyBaseline({
    report: sentences(reported),
    baseline: baselineOf(sentences(recorded), ROOT),
    root: ROOT,
  });

  return {
    severities: ruling.report.claims[0]?.findings.map((finding) => finding.severity) ?? [],
    known: ruling.known,
    stale: ruling.stale,
  };
};

describe("two findings wording the same thing in one file", () => {
  it("leaves the second failing while the baseline holds one entry for them both", () => {
    expect(ruledOn(2, 1).severities).toEqual(["warning", "error"]);
    expect(ruledOn(2, 1).known).toBe(1);
  });

  it("accepts both once the baseline holds an entry for each", () => {
    expect(ruledOn(2, 2).severities).toEqual(["warning", "warning"]);
    expect(ruledOn(2, 2).stale).toBe(0);
  });

  it("calls one entry stale when one of the two is fixed", () => {
    expect(ruledOn(1, 2).stale).toBe(1);
    expect(ruledOn(1, 2).known).toBe(1);
  });

  it("counts the second entry as new, so the commit accepting it says so", () => {
    const accepted = acceptanceOf({
      next: baselineOf(sentences(2), ROOT),
      previous: baselineOf(sentences(1), ROOT),
      report: sentences(2),
    });

    expect(accepted.added).toHaveLength(1);
    expect(accepted.retired).toEqual([]);
  });
});
