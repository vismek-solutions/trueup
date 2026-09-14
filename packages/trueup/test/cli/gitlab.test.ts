import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderGitlab } from "../../src/cli/reports/gitlab.ts";
import { runCli } from "../../src/cli/main.ts";
import type { Finding, Report } from "../../src/report/model.ts";
import { fixtureAt } from "../support/fixtures.ts";

const CLEAN = fixtureAt("explained");
const VIOLATING = fixtureAt("violating");
const BASELINED = fixtureAt("ci-baselined");

interface Issue {
  readonly description: string;
  readonly check_name: string;
  readonly fingerprint: string;
  readonly severity: string;
  readonly location: { readonly path: string; readonly lines: { readonly begin: number } };
}

const issues = async (cwd: string): Promise<readonly Issue[]> => {
  let output = "";
  await runCli({ cwd, argv: ["--gitlab"], write: (line) => (output += line) });
  return JSON.parse(output) as readonly Issue[];
};

describe("the gitlab code quality report", () => {
  it("is an empty array when every claim holds", async () => {
    expect(await issues(CLEAN)).toEqual([]);
  });

  it("names the claim as the check and the violating file as the path", async () => {
    const [issue] = await issues(VIOLATING);

    expect(issue?.check_name).toBe("every-import-respects-its-zone-boundary");
    expect(issue?.location.path).toBe("src/engine/runner.ts");
    expect(issue?.location.path).not.toContain("\\");
  });

  it("points at the line the import sits on", async () => {
    const [issue] = await issues(VIOLATING);

    expect(issue?.location.lines.begin).toBeGreaterThan(0);
  });

  it("carries the remedy, since gitlab shows the description and nothing else", async () => {
    const [issue] = await issues(VIOLATING);

    expect(issue?.description).toContain("may not reach domain");
    expect(issue?.description).toContain("Not the fix: widening the rule so the edge becomes legal.");
  });

  it("maps an error to major so gitlab does not rank it as advice", async () => {
    expect((await issues(VIOLATING))[0]?.severity).toBe("major");
  });

  it("ranks a baselined violation below a new one, so the widget sorts them apart", async () => {
    const severities = new Map(
      (await issues(BASELINED)).map((issue) => [issue.location.path, issue.severity]),
    );

    expect(severities.get("src/engine/fresh.ts")).toBe("major");
    expect(severities.get("src/engine/known.ts")).toBe("minor");
  });

  it("fingerprints without the position, so reformatting does not resurrect a finding", async () => {
    const [first] = await issues(VIOLATING);
    const [again] = await issues(VIOLATING);

    expect(first?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(first?.fingerprint).toBe(again?.fingerprint);
  });
});

const ROOT = join(fixtureAt("violating"));
const RULEBOOK = join(ROOT, "trueup.config.ts");

const finding = (over: Partial<Finding>): Finding => ({
  severity: "error",
  message: "something is wrong",
  file: null,
  start: null,
  ...over,
});

const rendered = (findings: readonly Finding[], claim = "a-claim"): readonly Issue[] => {
  const report: Report = {
    claims: [{ claim, guidance: "the remedy", findings }],
    coverage: {
      files: 1,
      edges: 0,
      symbolEdges: 0,
      namespaceEdges: 0,
      externalEdges: 0,
      builtinEdges: 0,
      unresolvedImports: 0,
      filesByZone: {},
      unclassifiedFiles: 0,
    },
  };
  return JSON.parse(renderGitlab(report, ROOT, RULEBOOK)) as readonly Issue[];
};

describe("a finding gitlab still has to be shown somewhere", () => {
  it("puts one belonging to no file against the rulebook, which is what configured it", () => {
    expect(rendered([finding({})])[0]?.location.path).toBe("trueup.config.ts");
  });

  it("puts it on the first line, since there is no position to point at", () => {
    expect(rendered([finding({})])[0]?.location.lines.begin).toBe(1);
  });

  it("does the same for a file with no position, rather than dropping the finding", () => {
    const issue = rendered([finding({ file: join(ROOT, "src/engine/runner.ts") })])[0];

    expect(issue?.location.path).toBe("src/engine/runner.ts");
    expect(issue?.location.lines.begin).toBe(1);
  });

  it("maps a warning to minor, which is the other half of the severity it reports", () => {
    expect(rendered([finding({ severity: "warning" })])[0]?.severity).toBe("minor");
  });
});

describe("what a fingerprint is made of", () => {
  const printOf = (findings: readonly Finding[], claim?: string): string | undefined =>
    rendered(findings, claim)[0]?.fingerprint;

  it("changes when the message does, so a reworded finding is a new one", () => {
    expect(printOf([finding({})])).not.toBe(printOf([finding({ message: "something else" })]));
  });

  it("changes when the claim does, so two claims about one file stay apart", () => {
    expect(printOf([finding({})])).not.toBe(printOf([finding({})], "another-claim"));
  });

  it("changes when the file does, so one message in two places is two findings", () => {
    const here = printOf([finding({ file: join(ROOT, "src/engine/runner.ts") })]);

    expect(here).not.toBe(printOf([finding({ file: join(ROOT, "src/engine/other.ts") })]));
  });

  it("survives a move of the position, which is the whole point of leaving it out", () => {
    const file = join(ROOT, "src/engine/runner.ts");

    expect(printOf([finding({ file, start: 0 })])).toBe(printOf([finding({ file, start: 400 })]));
  });
});
