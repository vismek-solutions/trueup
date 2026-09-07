#!/usr/bin/env node
import { runGuard } from "../src/cli/guard.ts";
import { runCli } from "../src/cli/main.ts";

const argv = process.argv.slice(2);
const write = (line) => process.stdout.write(`${line}\n`);

if (argv[0] === "guard") {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  process.exitCode = await runGuard({
    cwd: process.cwd(),
    stdin: Buffer.concat(chunks).toString("utf8"),
    write,
  });
} else {
  process.exitCode = await runCli({ cwd: process.cwd(), argv, write });
}
