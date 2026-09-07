#!/usr/bin/env node
import { runCli } from "../src/cli/main.ts";

const code = await runCli({
  cwd: process.cwd(),
  argv: process.argv.slice(2),
  write: (line) => process.stdout.write(`${line}\n`),
});

process.exitCode = code;
