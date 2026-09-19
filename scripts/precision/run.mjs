import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const BIN = join(ROOT, "packages/trueup/bin/trueup.js");
const MODEL = process.env.PRECISION_MODEL ?? "claude-sonnet-5";
const CORPUS = process.env.PRECISION_CORPUS ?? join(ROOT, "node_modules/.pnpm");
const PAGES = Number(process.env.PRECISION_PAGES ?? 600);
const PER_CLAIM = Number(process.env.PRECISION_PER_CLAIM ?? 30);
const BATCH = 25;

const SETTINGS = {
  marks: ["—", "–", "--", "·"],
  words: [
    { word: "leverage", instead: "use" },
    { word: "utilize", instead: "use" },
    { word: "seamless", instead: "smooth" },
    { word: "powerful", instead: "a plain description of what it does" },
    { word: "simply", instead: "nothing, and delete the word" },
  ],
  maxSentenceWords: 30,
  maxParagraphSentences: 5,
  maxInlineCodeWords: 4,
  links: true,
  maxSectionWordsWithoutExample: 200,
};

const ASKED = [
  "You are auditing a markdown checker for false positives. You have no tools, and the numbered",
  "lines below are everything you get, so never ask to open a file.",
  "For each finding below, decide whether the thing its message describes is really there,",
  "in the prose of that file, at that line. A finding is wrong when the text it points at is",
  "inside a fenced block, a table, frontmatter, inline code, a URL or a link target, or when the",
  "thing it quotes is not in the lines shown at all. The lines are numbered, and a long line is cut",
  "at 500 characters, so judge a count as right unless the lines contradict it.",
  "Judge only that. Whether the rule itself is a good idea is not the question.",
  "Answer with one fenced json block holding [{ id, verdict, why }], verdict being right or wrong,",
  "and why being at most twelve words.",
];

const spread = (path) => {
  let hash = 7;
  for (const code of path) hash = (hash * 31 + code.codePointAt(0)) % 1_000_003;
  return hash;
};

const markdownIn = (dir) => {
  const found = [];

  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".md")) found.push(path);
    }
  };

  walk(dir);
  return found.sort((left, right) => spread(left) - spread(right)).slice(0, PAGES);
};

const projectFor = (run, files) => {
  mkdirSync(join(run, "corpus"), { recursive: true });
  for (const file of files) {
    cpSync(file, join(run, "corpus", relative(CORPUS, file).replaceAll("/", "__")));
  }

  mkdirSync(join(run, "src"), { recursive: true });
  writeFileSync(join(run, "src/only.ts"), "export const only = 1;\n");
  writeFileSync(
    join(run, "trueup.config.ts"),
    `export default ${JSON.stringify(
      {
        include: ["src", "corpus"],
        zones: [{ name: "src", patterns: ["src/**"] }],
        text: { files: ["corpus/*.md"], ...SETTINGS },
      },
      null,
      2,
    )};\n`,
  );
};

const reportIn = (run) => {
  try {
    return JSON.parse(execFileSync("node", [BIN, "--json"], { cwd: run, encoding: "utf8", maxBuffer: 64e6 }));
  } catch (error) {
    const printed = error.stdout ?? "";
    if (!printed.startsWith("{")) throw error;
    return JSON.parse(printed);
  }
};

const PROSE = new Set([
  "no-prose-uses-a-banned-mark",
  "no-prose-uses-a-banned-word",
  "no-passage-runs-past-its-limit",
  "no-inline-code-holds-more-than-a-path",
  "every-link-says-where-it-goes",
  "every-long-section-shows-an-example",
]);

const HEADING = /^ {0,3}#{1,6} /;

const windowed = (lines, at, whole) => {
  const from = Math.max(0, at - 3);
  const ends = (line) => (whole ? HEADING.test(line) : line.trim() === "");
  let to = at + 7;
  while (to < lines.length && to - from < (whole ? 90 : 40) && !ends(lines[to] ?? "")) to += 1;

  return lines
    .slice(from, to)
    .map((text, index) => `${from + 1 + index}| ${text.slice(0, 500)}`)
    .join("\n")
    .slice(0, 12_000);
};

const foundIn = (report) =>
  (report.claims ?? [])
    .filter((claim) => PROSE.has(claim.claim))
    .flatMap((claim) =>
      (claim.findings ?? []).map((finding) => {
        const lines = readFileSync(finding.file, "utf8").split("\n");
        const at = readFileSync(finding.file, "utf8")
          .slice(0, finding.start ?? 0)
          .split("\n").length;

        return {
          claim: claim.claim,
          message: finding.message,
          file: (finding.file ?? "").split("/").at(-1) ?? "",
          line: at,
          context: windowed(lines, at, claim.claim === "every-long-section-shows-an-example"),
        };
      }),
    );

const sampled = (all) => {
  const perClaim = new Map();
  return all.filter((finding) => {
    const seen = perClaim.get(finding.claim) ?? 0;
    perClaim.set(finding.claim, seen + 1);
    return seen < PER_CLAIM;
  });
};

const verdictsFor = (batch, at) => {
  const asked = [
    ...ASKED,
    "",
    ...batch.map((finding, index) =>
      [
        `## finding ${index}`,
        `claim: ${finding.claim}`,
        `says: ${finding.message}`,
        `file: ${finding.file}, and it names line ${finding.line}`,
        finding.context,
      ].join("\n"),
    ),
  ].join("\n\n");

  const answer = execFileSync(
    "claude",
    ["-p", "--safe-mode", "--no-session-persistence", "--model", MODEL, "--tools", ""],
    { input: asked, encoding: "utf8", maxBuffer: 16e6 },
  );

  writeFileSync(join(RUN, `answer-${at}.md`), answer);
  const block = /```(?:json)?\n([\s\S]*?)```/.exec(answer);
  const parsed = block === null ? [] : JSON.parse(block[1]);

  return Array.isArray(parsed) ? parsed : (Object.values(parsed).find(Array.isArray) ?? []);
};

const idIn = (verdict) => Number(/\d+/.exec(String(verdict.id ?? ""))?.[0] ?? Number.NaN);

const say = (text) => process.stdout.write(`${text}\n`);

const RUN = mkdtempSync(join(tmpdir(), "precision-"));
const pages = markdownIn(CORPUS);
projectFor(RUN, pages);

const found = sampled(foundIn(reportIn(RUN)));
say(`precision  ${pages.length} pages · ${found.length} findings · ${MODEL}\n`);

const verdicts = new Map();
for (let at = 0; at < found.length; at += BATCH) {
  const batch = verdictsFor(found.slice(at, at + BATCH), at);
  const mapped = batch.filter((verdict) => !Number.isNaN(idIn(verdict)));
  for (const verdict of mapped) verdicts.set(at + idIn(verdict), verdict);
  say(`  judged ${verdicts.size} of ${Math.min(BATCH + at, found.length)} from ${at}`);
}

say("");

const judged = found.map((finding, id) => ({ ...finding, ...(verdicts.get(id) ?? { verdict: "unjudged" }) }));
writeFileSync(join(RUN, "verdicts.json"), `${JSON.stringify(judged, null, 2)}\n`);

for (const claim of PROSE) {
  const mine = judged.filter((finding) => finding.claim === claim);
  if (mine.length === 0) continue;

  const right = mine.filter((finding) => finding.verdict === "right").length;
  const wrong = mine.filter((finding) => finding.verdict === "wrong");
  const held = mine.length - right - wrong.length;
  const unjudged = held === 0 ? "" : ` · ${held} unjudged`;
  say(`${claim.padEnd(38)}${right} right · ${wrong.length} wrong of ${mine.length}${unjudged}`);
  for (const finding of wrong.slice(0, 5)) say(`    ${finding.file}:${finding.line}  ${finding.why}`);
}

say(`\nevery verdict, with the line it judged: ${join(RUN, "verdicts.json")}`);
