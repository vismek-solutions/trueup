const mode = process.argv[2];
const subcommand = process.argv[5];

if (subcommand === "merge-base") {
  process.stdout.write("0000000000000000000000000000000000000000\n");
  process.exit(0);
}

if (subcommand === "diff") {
  if (mode === "dies-on-diff") process.kill(process.pid, "SIGKILL");
  process.stdout.write("2\t1\tkept.ts\n");
  process.exit(0);
}

if (mode === "dies-on-others") process.kill(process.pid, "SIGKILL");

process.stdout.write("refused.ts\n");
process.exit(1);
