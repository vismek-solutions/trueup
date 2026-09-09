const mode = process.argv[2];

if (process.argv.includes("config")) {
  if (mode === "config-silent") process.exit(0);
  // real fallow reads its config regardless; this one answers only the exact call the runner owes it
  const [subcommand, rootFlag, , formatFlag, format] = process.argv.slice(3);
  const shape = [subcommand, rootFlag, formatFlag, format].join(" ");
  if (shape !== "config --root --format json" || process.argv.length !== 8) {
    process.stdout.write(JSON.stringify({ askedWith: process.argv.slice(3).join(" ") }));
    process.exit(0);
  }

  const rules = { "unused-exports": "error", "circular-dependencies": "error", "unused-types": "error" };
  if (mode === "rule-off") rules["unused-exports"] = "off";
  if (mode === "rules-off") rules["unused-exports"] = rules["unused-types"] = "off";
  process.stdout.write(JSON.stringify(mode === "no-rules" ? {} : { rules }));
  process.exit(0);
}

if (mode === "silent") process.exit(0);

if (mode === "not-json") {
  process.stdout.write("this is not json\n");
  process.exit(0);
}

if (mode === "no-check") {
  process.stdout.write(JSON.stringify({ kind: "fallow", dupes: {} }));
  process.exit(0);
}

if (mode === "old-schema") {
  process.stdout.write(JSON.stringify({ check: { schema_version: 1, unused_exports: [] } }));
  process.exit(0);
}

const check = {
  schema_version: 9,
  unused_exports: [{ path: "src/engine/runner.ts", export_name: "run", line: 3, col: 13 }],
  circular_dependencies: [{ cycle: ["a.ts", "b.ts"] }],
  a_category_fallow_added: [{}],
  unused_types: [
    { name: "Placeless", line: 4, col: 2 },
    { path: "src/engine/runner.ts", name: "Lineless", col: 2 },
  ],
};

if (mode === "argv") {
  const seen = process.argv.slice(3).map((arg) => ({ name: arg }));
  const said = { check: { ...check, unused_exports: seen }, dupes: { clone_groups: [] } };
  process.stdout.write(JSON.stringify(said));
  process.exit(0);
}

const CLONES = {
  named: {
    line_count: 7,
    fingerprint: "a-fingerprint",
    instances: [
      { file: "src/engine/runner.ts", start_line: 3, start_col: 13 },
      { file: "src/domain/thing.ts", start_line: 1, start_col: 1 },
    ],
  },
  unnamed: {
    instances: [
      { file: "src/engine/runner.ts", start_line: 3, start_col: 13 },
      { file: "src/domain/thing.ts", start_line: 1, start_col: 1 },
    ],
  },
  partial: {
    line_count: 4,
    fingerprint: "a-partial-group",
    instances: [{ start_line: 3 }, { file: "src/domain/thing.ts", start_line: 1, start_col: 1 }],
  },
  unplaceable: {
    line_count: 4,
    fingerprint: "an-unplaceable-group",
    instances: [{ file: "src/engine/runner.ts" }, { start_line: 3 }],
  },
  "no-instances": { line_count: 4, fingerprint: "an-empty-group" },
  mixed: {
    line_count: 5,
    fingerprint: "a-mixed-group",
    instances: [
      { file: "src/engine/runner.ts", start_line: 3, start_col: 13 },
      { file: "src/domain/thing.ts", start_line: 1, start_col: 1 },
      { file: "src/engine/other.ts", start_line: 2, start_col: 1 },
      { start_line: 9 },
      { file: "src/domain/nameless.ts" },
    ],
  },
};

if (mode in CLONES) {
  process.stdout.write(JSON.stringify({ check, dupes: { clone_groups: [CLONES[mode]] } }));
  process.exit(0);
}

if (mode === "no-clone-groups") {
  process.stdout.write(JSON.stringify({ check, dupes: {} }));
  process.exit(0);
}

if (mode === "null-dupes") {
  process.stdout.write(JSON.stringify({ check, dupes: null }));
  process.exit(0);
}

process.stdout.write(JSON.stringify({ check }));
