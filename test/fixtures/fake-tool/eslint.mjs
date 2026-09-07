import { join } from "node:path";

const mode = process.argv[2];

if (mode === "silent") process.exit(0);

if (mode === "not-json") {
  process.stdout.write("this is not json\n");
  process.exit(0);
}

if (mode === "not-array") {
  process.stdout.write(JSON.stringify({ results: [] }));
  process.exit(0);
}

if (mode === "empty") {
  process.stdout.write("[]");
  process.exit(0);
}

if (mode === "bad-shape") {
  process.stdout.write(JSON.stringify([{ filePath: "a.ts" }]));
  process.exit(0);
}

if (mode === "config-error") {
  process.stderr.write("Oops! Something went wrong! :(\n\nESLint: 9.0.0\n\nESLint couldn't find an eslint.config.js file.\n");
  process.exit(2);
}

const filePath = join(process.cwd(), "src/engine/runner.ts");

if (mode === "fatal") {
  process.stdout.write(
    JSON.stringify([
      { filePath, messages: [{ ruleId: null, fatal: true, severity: 2, message: "Parsing error: Unexpected token", line: 1, column: 1 }] },
    ]),
  );
  process.exit(1);
}

process.stdout.write(
  JSON.stringify([
    {
      filePath,
      messages: [
        { ruleId: "no-unused-vars", severity: 2, message: "'run' is assigned a value but never used.", line: 3, column: 14 },
        { ruleId: "prefer-const", severity: 1, message: "'thing' is never reassigned.", line: 1, column: 10 },
      ],
    },
    { filePath: join(process.cwd(), "src/domain/thing.ts"), messages: [] },
  ]),
);
process.exit(1);
