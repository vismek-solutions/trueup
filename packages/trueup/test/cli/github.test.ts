import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/main.ts";
import { renderGithub } from "../../src/cli/reports/github.ts";
import type { Report } from "../../src/report/model.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { error, reportOf, warning } from "../support/sample-report.ts";

const CLEAN = fixtureAt("explained");
const VIOLATING = fixtureAt("violating");
const BASELINED = fixtureAt("ci-baselined");

const sarifFor = async (cwd: string) => {
  let output = "";
  await runCli({ cwd, argv: ["--github"], write: (line) => (output += line) });
  return JSON.parse(output);
};

const resultsFor = async (cwd: string) => (await sarifFor(cwd)).runs[0].results;

const rulesFor = async (cwd: string) => (await sarifFor(cwd)).runs[0].tool.driver.rules;

describe("the github code scanning report", () => {
  it("is a run with no results when every claim holds, so github closes what the branch fixed", async () => {
    const log = await sarifFor(CLEAN);

    expect(log.version).toBe("2.1.0");
    expect(log.runs[0].results).toEqual([]);
  });

  it("names the claim as the rule and the violating file as the path", async () => {
    const [result] = await resultsFor(VIOLATING);
    const uri: string = result.locations[0].physicalLocation.artifactLocation.uri;

    expect(result.ruleId).toBe("every-import-respects-its-zone-boundary");
    expect(uri).toBe("src/engine/runner.ts");
    expect(uri).not.toContain("\\");
  });

  it("points at the line and the column the import sits on", async () => {
    const { region } = (await resultsFor(VIOLATING))[0].locations[0].physicalLocation;

    expect(region.startLine).toBeGreaterThan(0);
    expect(region.startColumn).toBeGreaterThan(0);
  });

  it("carries the remedy as rule help, since that is the field the alert view shows", async () => {
    const [rule] = await rulesFor(VIOLATING);

    expect(rule.id).toBe("every-import-respects-its-zone-boundary");
    expect(rule.help.text).toContain("Not the fix: widening the rule so the edge becomes legal.");
  });

  it("keeps the short description to the opening, which is all a one line view fits", async () => {
    const [rule] = await rulesFor(VIOLATING);

    expect(rule.shortDescription.text).not.toContain("Do this:");
    expect(rule.fullDescription.text).toContain("Do this:");
  });

  it("leaves a baselined violation at warning, so only a new one fails the branch", async () => {
    const levels = new Map<string, string>();

    for (const result of await resultsFor(BASELINED)) {
      levels.set(result.locations[0].physicalLocation.artifactLocation.uri, result.level);
    }

    expect(levels.get("src/engine/fresh.ts")).toBe("error");
    expect(levels.get("src/engine/known.ts")).toBe("warning");
  });

  it("fingerprints without the position, so reformatting does not reopen an alert", async () => {
    const [first] = await resultsFor(VIOLATING);
    const [again] = await resultsFor(VIOLATING);

    expect(first.partialFingerprints["trueupFinding/v1"]).toMatch(/^[0-9a-f]{64}$/);
    expect(first.partialFingerprints).toEqual(again.partialFingerprints);
  });
});

const ROOT = fixtureAt("violating");
const RULEBOOK = join(ROOT, "trueup.config.ts");

const GUIDANCE = "the opening\n\nDo this:\n- the remedy";

const renderedFor = (claims: Report["claims"]) =>
  JSON.parse(renderGithub(reportOf(claims), ROOT, RULEBOOK));

const resultsOf = (claims: Report["claims"]) => renderedFor(claims).runs[0].results;

describe("a finding github still has to anchor somewhere", () => {
  const unplaced = [{ claim: "a-claim", guidance: GUIDANCE, findings: [error("adrift", null)] }];

  it("puts one belonging to no file against the rulebook, which is what configured it", () => {
    const { artifactLocation } = resultsOf(unplaced)[0].locations[0].physicalLocation;

    expect(artifactLocation.uri).toBe("trueup.config.ts");
  });

  it("puts it on the first line, since there is no position to point at", () => {
    expect(resultsOf(unplaced)[0].locations[0].physicalLocation.region.startLine).toBe(1);
  });

  it("leaves the column out rather than inventing one, since nothing located it", () => {
    const { region } = resultsOf(unplaced)[0].locations[0].physicalLocation;

    expect(region).not.toHaveProperty("startColumn");
  });

  it("reports a warning as a warning, which is the other half of the severity it carries", () => {
    const kept = [{ claim: "a-claim", guidance: GUIDANCE, findings: [warning("adrift", null)] }];

    expect(resultsOf(kept)[0].level).toBe("warning");
  });
});

describe("the rule list a result points into", () => {
  const TWICE = { claim: "a-claim", guidance: GUIDANCE, findings: [error("one", null), error("two", null)] };
  const OTHER = { claim: "another-claim", guidance: "a different opening", findings: [error("three", null)] };

  it("describes a claim once however many times it reports", () => {
    expect(renderedFor([TWICE]).runs[0].tool.driver.rules).toHaveLength(1);
  });

  it("indexes every result at the rule that explains it", () => {
    const log = renderedFor([TWICE, OTHER]);
    const rules = log.runs[0].tool.driver.rules;

    expect(log.runs[0].results).toHaveLength(3);
    for (const result of log.runs[0].results) {
      expect(rules[result.ruleIndex].id).toBe(result.ruleId);
    }
  });
});
