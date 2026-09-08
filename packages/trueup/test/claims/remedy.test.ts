import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { reportForConfig } from "../support/report.ts";

const CONFIGS = ["doors", "grants", "violating", "federated"].map((name) =>
  join(fixtureAt(name), "trueup.config.ts"),
);

const A_SENTENCE = 40;

describe("every claim carries the remedy for what it reports", () => {
  it("names a fix in every claim it runs, so a finding is never a bare accusation", async () => {
    const reports = await Promise.all(CONFIGS.map(reportForConfig));
    const claims = reports.flatMap((report) => report.claims);

    const bare = claims
      .filter((claim) => claim.guidance.trim().length < A_SENTENCE)
      .map((claim) => claim.claim);

    expect(bare).toEqual([]);
    expect(claims.length).toBeGreaterThan(0);
  });
});
