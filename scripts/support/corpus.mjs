import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(resolve(HERE, "../.."), "packages/trueup/bin/trueup.js");

export const SETTINGS = {
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

export const PROSE = new Set([
  "no-prose-uses-a-banned-mark",
  "no-prose-uses-a-banned-word",
  "no-passage-runs-past-its-limit",
  "no-inline-code-holds-more-than-a-path",
  "every-link-says-where-it-goes",
  "every-long-section-shows-an-example",
]);

export const say = (text) => process.stdout.write(`${text}\n`);

export const lineAt = (source, offset) => source.slice(0, offset).split("\n").length;

const spread = (path) => {
  let hash = 7;
  for (const code of path) hash = (hash * 31 + code.codePointAt(0)) % 1_000_003;
  return hash;
};

export const markdownIn = (dir, pages) => {
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
  return found.sort((left, right) => spread(left) - spread(right)).slice(0, pages);
};

export const projectFor = (run, files, corpus) => {
  mkdirSync(join(run, "corpus"), { recursive: true });
  for (const file of files) cpSync(file, join(run, "corpus", relative(corpus, file).replaceAll("/", "__")));

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

export const reportIn = (run) => {
  try {
    return JSON.parse(execFileSync("node", [BIN, "--json"], { cwd: run, encoding: "utf8", maxBuffer: 64e6 }));
  } catch (error) {
    const printed = error.stdout ?? "";
    if (!printed.startsWith("{")) throw error;
    return JSON.parse(printed);
  }
};

const HEADING = /^ {0,3}#{1,6} /;

export const windowed = (lines, at, whole) => {
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

const idIn = (verdict) => Number(/\d+/.exec(String(verdict.id ?? ""))?.[0] ?? Number.NaN);

const judged = (asked, model, into) => {
  const answer = execFileSync(
    "claude",
    ["-p", "--safe-mode", "--no-session-persistence", "--model", model, "--tools", ""],
    { input: asked, encoding: "utf8", maxBuffer: 16e6 },
  );

  writeFileSync(into, answer);
  const block = /```(?:json)?\n([\s\S]*?)```/.exec(answer);
  const parsed = block === null ? [] : JSON.parse(block[1]);

  return Array.isArray(parsed) ? parsed : (Object.values(parsed).find(Array.isArray) ?? []);
};

export const rulingsFor = ({ items, asking, model, run, batch = 25 }) => {
  const verdicts = new Map();

  for (let at = 0; at < items.length; at += batch) {
    const answered = judged(asking(items.slice(at, at + batch)), model, join(run, `answer-${at}.md`));
    for (const one of answered.filter((verdict) => !Number.isNaN(idIn(verdict)))) verdicts.set(at + idIn(one), one);
    say(`  judged ${verdicts.size} of ${Math.min(batch + at, items.length)} from ${at}`);
  }

  const ruled = items.map((item, id) => ({ ...item, ...(verdicts.get(id) ?? { verdict: "unjudged" }) }));
  writeFileSync(join(run, "verdicts.json"), `${JSON.stringify(ruled, null, 2)}\n`);

  return ruled;
};
