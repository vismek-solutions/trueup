import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const CASES = join(HERE, "fixtures");
const PAGES = join(ROOT, "apps/docs/src/content/docs");
const BIN = join(ROOT, "packages/trueup/bin/trueup.js");
const MODEL = process.env.TEACHES_MODEL ?? "claude-sonnet-5";

const ASKED = [
  "You are setting up a tool called trueup on a project. The guide page below is all you have.",
  "Answer with one fenced typescript block holding the whole rulebook file, and nothing else.",
];

const filesIn = (dir, base = dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesIn(path, base) : [relative(base, path)];
  });

const promptFor = (name, pages) => {
  const tree = join(CASES, name, "tree");

  return [
    ...ASKED,
    "",
    ...pages.flatMap((page) => [`# The guide page: ${page}`, "", readFileSync(join(PAGES, page), "utf8"), ""]),
    "# The project",
    "",
    ...filesIn(tree).flatMap((file) => [
      `${file}`,
      "```ts",
      readFileSync(join(tree, file), "utf8").trimEnd(),
      "```",
      "",
    ]),
    "# The task",
    "",
    readFileSync(join(CASES, name, "task.md"), "utf8"),
  ].join("\n");
};

const answerTo = (prompt) =>
  execFileSync(
    "claude",
    ["-p", "--safe-mode", "--no-session-persistence", "--model", MODEL, "--tools", ""],
    { input: prompt, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );

const rulebookIn = (answer) => {
  const block = /```(?:ts|typescript)?\n([\s\S]*?)```/.exec(answer);
  if (block === null) return null;

  const body = block[1]
    .split("\n")
    .filter((line) => !line.startsWith("import "))
    .join("\n");

  return `const defineConfig = (config) => config;\n\n${body}`;
};

const reportIn = (dir) => {
  try {
    return JSON.parse(execFileSync("node", [BIN, "--json"], { cwd: dir, encoding: "utf8" }));
  } catch (error) {
    const printed = error.stdout ?? "";
    return printed.startsWith("{") ? JSON.parse(printed) : { claims: [], refused: printed.trim() };
  }
};

const firedOn = (report, expect, file) =>
  (report.claims ?? []).some(
    (claim) =>
      claim.claim === expect &&
      (claim.findings ?? []).some((finding) => (finding.file ?? "").endsWith(file)),
  );

const verdictFor = (name) => {
  const { pages, expect, file } = JSON.parse(readFileSync(join(CASES, name, "case.json"), "utf8"));
  const run = mkdtempSync(join(tmpdir(), `teaches-${name}-`));
  cpSync(join(CASES, name, "tree"), run, { recursive: true });

  const answer = answerTo(promptFor(name, pages));
  writeFileSync(join(run, "answer.md"), answer);

  const rulebook = rulebookIn(answer);
  if (rulebook === null) return { name, passed: false, said: "no typescript block in the answer", run };

  writeFileSync(join(run, "trueup.config.ts"), rulebook);
  const report = reportIn(run);
  if (firedOn(report, expect, file)) return { name, passed: true, said: `${expect} fired on ${file}`, run };

  return { name, passed: false, said: report.refused ?? `${expect} said nothing about ${file}`, run };
};

const named = process.argv.slice(2);
const wanted = named.length > 0 ? named : readdirSync(CASES).filter((name) => !name.startsWith("."));

const say = (line) => process.stdout.write(`${line}\n`);

say(`teaches  ${wanted.length} cases · ${MODEL}\n`);

let passed = 0;
for (const name of wanted) {
  const verdict = verdictFor(name);
  passed += verdict.passed ? 1 : 0;
  say(`${name.padEnd(14)}${verdict.passed ? "pass" : "fail"}  ${verdict.said}`);
  if (!verdict.passed) say(`${" ".repeat(14)}      ${verdict.run}`);
}

say(`\n${passed} of ${wanted.length} pages taught enough to do the task`);
process.exitCode = passed === wanted.length ? 0 : 1;
