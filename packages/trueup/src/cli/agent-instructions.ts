import { DEFAULT_COMMAND } from "../report/invocation.ts";
import { rulebookIn } from "./preamble.ts";

export interface RunAgentInstructionsInput {
  readonly cwd: string;
  readonly write: (line: string) => void;
}

export const adviceLines = (command: string): readonly string[] => [
  `- \`${command} explain <file>\` — run this **before** creating or moving a file. It reports the zone that`,
  "  path falls into, which zones it may and may not reach, and the vocabulary it may not name.",
  `- \`${command} --dots\` — check the whole project. Run it before calling a change done. It prints`,
  "  one character per claim and explains only what failed.",
  `- \`${command} --next\` — the first problem to fix, with its remedy. \`--next=<claim>\` picks the claim.`,
  "",
  "Every finding is printed with an explanation of what it means and how to resolve it. Read that",
  "explanation before changing anything.",
  "",
  "Fix the code, not the rule. Widening a boundary, adding a word to an allow list, or recording a",
  "violation in the baseline to make a check pass defeats the check. If a rule looks wrong, say so",
  "and leave it failing rather than editing it to be quiet.",
];

export async function runAgentInstructions({ cwd, write }: RunAgentInstructionsInput): Promise<number> {
  const loaded = await rulebookIn(cwd, write);
  if (typeof loaded === "number") return loaded;

  const { config } = loaded;
  const command = config.command ?? DEFAULT_COMMAND;
  const zones = config.zones.map((zone) => zone.name).join(", ");

  for (const line of [
    "## Architecture",
    "",
    `This project's structure is enforced. Zones: ${zones}.`,
    "",
    ...adviceLines(command),
  ]) {
    write(line);
  }

  return 0;
}
