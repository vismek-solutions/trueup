const mode = process.argv[2];

if (process.argv.includes("config")) {
  const rules = { "unused-exports": "error", "circular-dependencies": "error", "unused-types": "error" };
  if (mode === "rule-off") rules["unused-exports"] = "off";
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

process.stdout.write(
  JSON.stringify({
    check: {
      schema_version: 9,
      unused_exports: [{ path: "src/engine/runner.ts", export_name: "run", line: 3, col: 13 }],
      circular_dependencies: [{ cycle: ["a.ts", "b.ts"] }],
      unused_types: [],
    },
  }),
);
