#!/usr/bin/env node
import { runActivate } from "./activate/run.ts";
import { runAgentInstructions } from "./agent-instructions.ts";
import { runCalibrate } from "./calibrate/run.ts";
import type { CommandInput } from "./command.ts";
import { runDocs } from "./docs/run.ts";
import { runExplain } from "./explain/run.ts";
import { runGuard } from "./guard.ts";
import { runInit } from "./init/run.ts";
import { runCli } from "./main.ts";

const argv = process.argv.slice(2);
const write = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

type Command = (input: CommandInput) => number | Promise<number>;

const COMMANDS: Record<string, Command> = {
  init: runInit,
  explain: runExplain,
  activate: runActivate,
  "agent-instructions": runAgentInstructions,
  docs: runDocs,
  calibrate: runCalibrate,
};

const read = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

const cwd = process.cwd();
const named = COMMANDS[argv[0] ?? ""];

if (named !== undefined) {
  process.exitCode = await named({ cwd, argv: argv.slice(1), write });
} else if (argv[0] === "guard") {
  process.exitCode = await runGuard({ cwd, stdin: await read(), write });
} else {
  process.exitCode = await runCli({ cwd, argv, write });
}
