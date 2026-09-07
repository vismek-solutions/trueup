const mode = process.argv[2];

if (mode === "silent") process.exit(0);

if (mode === "not-json") {
  process.stdout.write("this is not json\n");
  process.exit(1);
}

const emit = (body) => {
  process.stdout.write(JSON.stringify(body));
  process.exit(1);
};

if (mode === "no-diagnostics-key") emit({ number_of_files: 2 });
if (mode === "no-count") emit({ diagnostics: [] });
if (mode === "no-files") emit({ diagnostics: [], number_of_files: 0 });

const diagnostic = (code, message, extra) => ({
  message,
  code,
  severity: "error",
  filename: "src/engine/runner.ts",
  labels: [{ span: { offset: 41, length: 5, line: 3, column: 14 } }],
  ...extra,
});

emit({
  diagnostics: [
    diagnostic("eslint(max-params)", "Arrow function has too many parameters (5). Maximum allowed is 3."),
    diagnostic("typescript(no-explicit-any)", "Unexpected any.", { severity: "warning" }),
    diagnostic("oxc/bad-shape", "A code with no scope parentheses."),
  ],
  number_of_files: 2,
});
