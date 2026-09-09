import { join } from "node:path";

const mode = process.argv[2];

if (mode === "silent") process.exit(0);

if (mode === "not-json") {
  process.stdout.write("this is not json\n");
  process.exit(1);
}

if (mode === "no-summary") {
  process.stdout.write(JSON.stringify({ diagnostics: [], command: "lint" }));
  process.exit(1);
}

const path = join(process.cwd(), "src/engine/runner.ts");
const at = (line, column) => ({ path, start: { line, column }, end: { line, column } });

const summary = (extra) => ({ changed: 0, unchanged: 2, diagnosticsNotPrinted: 0, ...extra });

const emit = (body) => {
  process.stderr.write("The `json` reporter is experimental and may change in patch releases.\n");
  process.stdout.write(JSON.stringify(body));
  process.exit(1);
};

if (mode === "no-files") {
  process.stderr.write("No files were processed in the specified paths.\n");
  emit({ summary: summary({ unchanged: 0 }), diagnostics: [], command: "lint" });
}

if (mode === "withheld") {
  emit({ summary: summary({ diagnosticsNotPrinted: 3 }), diagnostics: [], command: "lint" });
}

if (mode === "half-summary") {
  emit({ summary: { unchanged: 2, diagnosticsNotPrinted: 0 }, diagnostics: [], command: "lint" });
}

if (mode === "churn") {
  emit({
    summary: summary({ changed: 2, unchanged: 2 }),
    diagnostics: [
      { severity: "error", message: "Using == may be unsafe.", category: "lint/suspicious/noDoubleEquals", location: at(3, 14), advices: [] },
    ],
    command: "lint",
  });
}

if (mode === "no-unchanged") {
  emit({ summary: { changed: 1, diagnosticsNotPrinted: 0 }, diagnostics: [], command: "lint" });
}

if (mode === "unlocated-lint") {
  emit({
    summary: summary({}),
    diagnostics: [
      { severity: "error", message: "about no file in particular", category: "lint/style/useConst", advices: [] },
    ],
    command: "lint",
  });
}

if (mode === "unpositioned-lint") {
  emit({
    summary: summary({}),
    diagnostics: [
      { severity: "error", message: "about the whole file", category: "lint/style/useConst", location: { path }, advices: [] },
    ],
    command: "lint",
  });
}

if (mode === "not-a-diagnostic") {
  emit({ summary: summary({}), diagnostics: ["a bare string"], command: "lint" });
}

if (mode === "no-category") {
  emit({
    summary: summary({}),
    diagnostics: [{ severity: "error", message: "nothing says what this is", location: at(3, 14), advices: [] }],
    command: "lint",
  });
}

if (mode === "unlocated-parse-error") {
  emit({
    summary: summary({ unchanged: 1 }),
    diagnostics: [
      { severity: "error", message: "Expected an identifier.", category: "parse", advices: [] },
    ],
    command: "lint",
  });
}

if (mode === "terse") {
  emit({
    summary: summary({}),
    diagnostics: [
      { severity: "error", message: "", category: "lint/style/useConst", location: at(1, 10), advices: [] },
    ],
    command: "lint",
  });
}

if (mode === "parse-error") {
  emit({
    summary: summary({ unchanged: 1 }),
    diagnostics: [
      { severity: "error", message: "Expected an identifier but instead found the end of the file.", category: "parse", location: at(1, 1), advices: [] },
    ],
    command: "lint",
  });
}

if (mode === "internal-error") {
  emit({
    summary: summary({ unchanged: 1 }),
    diagnostics: [
      { severity: "error", message: "No such file or directory (os error 2)", category: "internalError/io", location: at(0, 0), advices: [] },
    ],
    command: "lint",
  });
}

if (mode === "report-args") {
  emit({
    summary: summary({}),
    diagnostics: [
      { severity: "error", message: process.argv.slice(3).join(" "), category: "lint/args", location: at(3, 14), advices: [] },
    ],
    command: "lint",
  });
}

if (mode === "relative-paths") {
  emit({
    summary: summary({}),
    diagnostics: [
      {
        severity: "error",
        message: "Using == may be unsafe if you are relying on type coercion.",
        category: "lint/suspicious/noDoubleEquals",
        location: { path: "src/engine/runner.ts", start: { line: 3, column: 14 }, end: { line: 3, column: 14 } },
        advices: [],
      },
    ],
    command: "lint",
  });
}

if (mode === "bad-severity") {
  emit({
    summary: summary({}),
    diagnostics: [
      { severity: "catastrophe", message: "something new", category: "lint/style/useConst", location: at(3, 14), advices: [] },
    ],
    command: "lint",
  });
}

emit({
  summary: summary({}),
  diagnostics: [
    { severity: "error", message: "Using == may be unsafe if you are relying on type coercion.", category: "lint/suspicious/noDoubleEquals", location: at(3, 14), advices: [] },
    { severity: "warning", message: "This let declares a variable that is only assigned once.", category: "lint/style/useConst", location: at(1, 10), advices: [] },
    { severity: "info", message: "The configuration schema version does not match the CLI version.", category: "deserialize", location: { path: join(process.cwd(), "biome.json"), start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, advices: [] },
  ],
  command: "lint",
});
