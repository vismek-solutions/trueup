import { describe, expect, it } from "vitest";
import { decideOnProposal } from "../../src/guard/decide.ts";
import { error, reportOf } from "../support/sample-report.ts";

const LISTED = reportOf([
  {
    claim: "a-claim",
    guidance: "g",
    findings: [error("serves 2 readerships:\n- alpha from src/one\n- beta from src/two", "/p/a.ts")],
  },
]);

const reasonFor = (path: string | null): string =>
  decideOnProposal({ report: LISTED, path, root: "/p" }).reasons[0] ?? "";

describe("a refusal over a finding that runs to several lines", () => {
  it("indents the lines after the first, so the list stays under the finding it belongs to", () => {
    expect(reasonFor("/p/a.ts").split("\n").slice(0, 4)).toEqual([
      "a-claim  a.ts",
      "  serves 2 readerships:",
      "    - alpha from src/one",
      "    - beta from src/two",
    ]);
  });

  it("indents the same way where the finding carries its own file, rather than losing the nesting", () => {
    expect(reasonFor(null).split("\n").slice(0, 4)).toEqual([
      "a-claim",
      "  a.ts  serves 2 readerships:",
      "    - alpha from src/one",
      "    - beta from src/two",
    ]);
  });
});
