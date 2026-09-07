import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { baselinePathIn, writeBaseline } from "../../src/adapters/baseline-file.ts";
import { runAgentInstructions } from "../../src/cli/agent-instructions.ts";
import { runCli } from "../../src/cli/main.ts";
import { COMMAND_TOKEN } from "../../src/report/invocation.ts";

const PROJECT = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "explained");
const VIOLATING = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "violating");

const capture = async (run: (write: (line: string) => void) => Promise<number>): Promise<string> => {
  let output = "";
  await run((line) => (output += `${line}\n`));
  return output;
};

describe("telling an agent which command to reach for", () => {
  it("names the explain command in the guidance for a boundary violation", async () => {
    const output = await capture((write) => runCli({ cwd: VIOLATING, argv: [], write }));
    expect(output).toContain("explain <file>");
  });

  it("leaves no unsubstituted placeholder in any guidance", async () => {
    const output = await capture((write) => runCli({ cwd: VIOLATING, argv: [], write }));
    expect(output).not.toContain(COMMAND_TOKEN);
  });

  it("leaves no unsubstituted placeholder in the stale-baseline guidance either", async () => {
    const baseline = baselinePathIn(PROJECT);
    writeBaseline(baseline, {
      entries: [{ claim: "every-import-respects-its-zone-boundary", file: "src/gone.ts", message: "gone" }],
    });

    try {
      const output = await capture((write) => runCli({ cwd: PROJECT, argv: [], write }));
      expect(output).toContain("--update-baseline");
      expect(output).not.toContain(COMMAND_TOKEN);
    } finally {
      rmSync(baseline, { force: true });
    }
  });

  it("tells the agent not to widen the rule", async () => {
    const output = await capture((write) => runCli({ cwd: VIOLATING, argv: [], write }));
    expect(output).toContain("Widening the rule is not the fix");
  });
});

describe("the block a project pastes into its agent instructions", () => {
  it("names the zones and both commands", async () => {
    const output = await capture((write) => runAgentInstructions({ cwd: PROJECT, write }));

    expect(output).toContain("Zones: engine, domain, shared");
    expect(output).toContain("trueline explain <file>");
    expect(output).toContain("before");
  });

  it("says to fix the code rather than the rule", async () => {
    const output = await capture((write) => runAgentInstructions({ cwd: PROJECT, write }));
    expect(output).toContain("Fix the code, not the rule");
    expect(output).toContain("baseline");
  });

  it("reports when there is no config to describe", async () => {
    let output = "";
    const code = await runAgentInstructions({ cwd: "/", write: (line) => (output += line) });

    expect(code).toBe(3);
    expect(output).toContain("no architecture.config.ts");
  });
});
