#!/usr/bin/env node
import { runAgentInstructions } from "./agent-instructions.ts";
import { runExplain } from "./explain.ts";
import { runGuard } from "./guard.ts";
import { runCli } from "./main.ts";

const argv = process.argv.slice(2);
const write = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

if (argv[0] === "agent-instructions") {
  process.exitCode = await runAgentInstructions({ cwd: process.cwd(), write });
} else if (argv[0] === "explain") {
  process.exitCode = await runExplain({ cwd: process.cwd(), argv: argv.slice(1), write });
} else if (argv[0] === "guard") {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  process.exitCode = await runGuard({
    cwd: process.cwd(),
    stdin: Buffer.concat(chunks).toString("utf8"),
    write,
  });
} else {
  process.exitCode = await runCli({ cwd: process.cwd(), argv, write });
}
