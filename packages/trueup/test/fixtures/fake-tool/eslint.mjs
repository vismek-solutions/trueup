import { join } from "node:path";

const mode = process.argv[2];

if (mode === "silent") process.exit(0);

if (mode === "whitespace") {
  process.stdout.write("   \n\n");
  process.exit(0);
}

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

if (mode === "report-args") {
  process.stdout.write(
    JSON.stringify([
      { filePath, messages: [{ ruleId: "args", severity: 2, message: process.argv.slice(3).join(" "), line: 3, column: 14 }] },
    ]),
  );
  process.exit(1);
}

if (mode === "no-file-path") {
  process.stdout.write(JSON.stringify([{ messages: [] }]));
  process.exit(0);
}

if (mode === "second-bad") {
  process.stdout.write(
    JSON.stringify([
      { filePath, messages: [{ ruleId: "prefer-const", severity: 1, message: "'thing' is never reassigned.", line: 1, column: 10 }] },
      { filePath: join(process.cwd(), "src/domain/thing.ts") },
    ]),
  );
  process.exit(1);
}

if (mode === "sparse") {
  process.stdout.write(
    JSON.stringify([
      {
        filePath,
        messages: [
          { ruleId: null, severity: 2, message: "reported by no rule in particular" },
          { ruleId: "no-message", severity: 1, line: 1, column: 10 },
          { ruleId: "no-column", severity: 1, message: "eslint gave a line and no column", line: 3 },
        ],
      },
    ]),
  );
  process.exit(1);
}

if (mode === "odd-suppressions") {
  process.stdout.write(
    JSON.stringify([
      {
        filePath,
        messages: [],
        suppressedMessages: [
          { ruleId: "bare", severity: 2, message: "silenced by nothing recorded", line: 3, column: 14 },
          {
            ruleId: "spaced",
            severity: 2,
            message: "silenced once",
            line: 3,
            column: 14,
            suppressions: [{ kind: "directive" }, { kind: "directive", justification: "  padded  " }],
          },
          {
            ruleId: "twice",
            severity: 2,
            message: "silenced twice",
            line: 3,
            column: 14,
            suppressions: [
              { kind: "directive", justification: "first" },
              { kind: "directive", justification: "second" },
            ],
          },
        ],
      },
    ]),
  );
  process.exit(1);
}

if (mode === "fatal") {
  process.stdout.write(
    JSON.stringify([
      { filePath, messages: [{ ruleId: null, fatal: true, severity: 2, message: "Parsing error: Unexpected token", line: 1, column: 1 }] },
    ]),
  );
  process.exit(1);
}

const messages = [
  { ruleId: "no-unused-vars", severity: 2, message: "'run' is assigned a value but never used.", line: 3, column: 14 },
  { ruleId: "prefer-const", severity: 1, message: "'thing' is never reassigned.", line: 1, column: 10 },
];

if (mode === "no-suppressed-field") {
  process.stdout.write(JSON.stringify([{ filePath, messages }]));
  process.exit(1);
}

process.stdout.write(
  JSON.stringify([
    {
      filePath,
      messages,
      suppressedMessages: [
        {
          ruleId: "eqeqeq",
          severity: 2,
          message: "Expected '===' and instead saw '=='.",
          line: 3,
          column: 14,
          suppressions: [{ kind: "directive", justification: "" }],
        },
        {
          ruleId: "no-console",
          severity: 1,
          message: "Unexpected console statement.",
          line: 1,
          column: 10,
          suppressions: [{ kind: "directive", justification: "needed for the CLI" }],
        },
      ],
    },
    { filePath: join(process.cwd(), "src/domain/thing.ts"), messages: [], suppressedMessages: [] },
  ]),
);
process.exit(1);
