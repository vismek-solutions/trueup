import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/main.ts";
import { fixtureAt } from "../support/fixtures.ts";

const CLEAN = fixtureAt("explained");
const VIOLATING = fixtureAt("violating");

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
    expect(issue?.description).toContain("Widening the rule is not the fix");
  });

  it("maps an error to major so gitlab does not rank it as advice", async () => {
    expect((await issues(VIOLATING))[0]?.severity).toBe("major");
  });

  it("fingerprints without the position, so reformatting does not resurrect a finding", async () => {
    const [first] = await issues(VIOLATING);
    const [again] = await issues(VIOLATING);

    expect(first?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(first?.fingerprint).toBe(again?.fingerprint);
  });
});
