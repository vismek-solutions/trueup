import { findConfig, loadConfig } from "../config/load.ts";
import { DEFAULT_COMMAND } from "../report/invocation.ts";

export interface RunAgentInstructionsInput {
  readonly cwd: string;
  readonly write: (line: string) => void;
}

export async function runAgentInstructions({ cwd, write }: RunAgentInstructionsInput): Promise<number> {
  const path = findConfig(cwd);
  if (path === null) {
    write("no architecture.config.ts found");
    return 3;
  }

  const { config } = await loadConfig(path);
  const command = config.command ?? DEFAULT_COMMAND;
  const zones = config.zones.map((zone) => zone.name).join(", ");

  for (const line of [
    "## Architecture",
    "",
    `This project's structure is enforced. Zones: ${zones}.`,
    "",
    `- \`${command} explain <file>\` — run this **before** creating or moving a file. It reports the zone that`,
    "  path falls into, which zones it may and may not reach, and the vocabulary it may not name.",
    `- \`${command}\` — check the whole project. Run it before calling a change done.`,
    "",
    "Every finding is printed with an explanation of what it means and how to resolve it. Read that",
    "explanation before changing anything.",
    "",
    "Fix the code, not the rule. Widening a boundary, adding a word to an allow list, or recording a",
    "violation in the baseline to make a check pass defeats the check. If a rule looks wrong, say so",
    "and leave it failing rather than editing it to be quiet.",
  ]) {
    write(line);
  }

  return 0;
}
