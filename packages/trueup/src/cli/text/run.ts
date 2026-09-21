import { DEFAULT_COMMAND } from "../../report/invocation.ts";
import { EXIT_BAD_USAGE, EXIT_CLEAN, type CommandInput } from "../command.ts";
import { listed } from "../listing.ts";
import { runCalibrate } from "./calibrate.ts";

interface TextCommand {
  readonly said: string;
  readonly run: (input: CommandInput) => Promise<number>;
}

const COMMANDS: Record<string, TextCommand> = {
  calibrate: {
    said: "what your own prose measures, so a text limit comes from it rather than a guess",
    run: runCalibrate,
  },
};

const ASKED_FOR_HELP = new Set(["", "--help"]);

const helpLines = (): readonly string[] => [
  `${DEFAULT_COMMAND} text — the prose the rulebook holds to the text claims`,
  "",
  `usage: ${DEFAULT_COMMAND} text <command> [arguments]`,
  "",
  "commands",
  ...listed(Object.fromEntries(Object.entries(COMMANDS).map(([name, one]) => [name, one.said]))),
];

export function runText({ cwd, argv, write }: CommandInput): number | Promise<number> {
  const [name = "", ...rest] = argv;
  const chosen = COMMANDS[name];
  if (chosen !== undefined) return chosen.run({ cwd, argv: rest, write });

  if (!ASKED_FOR_HELP.has(name)) write(`unrecognised: ${argv.join(" ")}`);
  for (const line of helpLines()) write(line);

  return ASKED_FOR_HELP.has(name) ? EXIT_CLEAN : EXIT_BAD_USAGE;
}
