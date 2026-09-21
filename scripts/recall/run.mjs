import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SETTINGS, lineAt, markdownIn, projectFor, reportIn, say, windowed } from "../support/corpus.mjs";
import { measured } from "../support/tally.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const MODEL = process.env.RECALL_MODEL ?? "claude-sonnet-5";
const CORPUS = process.env.RECALL_CORPUS ?? join(ROOT, "node_modules/.pnpm");
const PAGES = Number(process.env.RECALL_PAGES ?? 600);
const PER_CLAIM = Number(process.env.RECALL_PER_CLAIM ?? 30);
const BATCH = 25;

const ASKED = [
  "You are auditing a markdown checker for the violations it missed. You have no tools, and the",
  "numbered lines below are everything you get, so never ask to open a file.",
  "Each candidate below looks like a violation, and the checker said nothing about it. Decide whether",
  "the checker was right to stay quiet. It was right when the text sits where the rule does not reach:",
  "inside a fenced block, a table, frontmatter, inline code, a URL, a link target, an html block or an",
  "html comment. It was wrong, and the violation was missed, when the text is prose a reader reads.",
  "The lines are numbered, and a long line is cut at 500 characters.",
  "Answer with one fenced json block holding [{ id, verdict, why }], verdict being quiet or missed,",
  "and why being at most twelve words.",
];

const FENCE = /^ {0,3}(?:`{3,}|~{3,})/;
const CODE_SPAN = /`([^`\n]+)`/g;
const PLAIN_WORD = /^[a-z]+$/;

const spelling = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const counted = (text) => text.split(/\s+/).filter((word) => word !== "");

const blankedOut = (source) => {
  const lines = source.split("\n");
  let fenced = false;
  let front = lines[0]?.trim() === "---";

  return lines
    .map((line, index) => {
      const blank = " ".repeat(line.length);
      if (front) {
        front = !(index > 0 && line.trim() === "---");
        return blank;
      }
      if (FENCE.test(line)) {
        fenced = !fenced;
        return blank;
      }
      return fenced ? blank : line;
    })
    .join("\n");
};

const blocksIn = (text) => {
  const blocks = [];
  let at = 0;
  let open = -1;

  for (const line of text.split("\n")) {
    if (line.trim() === "") {
      if (open >= 0) blocks.push({ start: open, text: text.slice(open, at - 1) });
      open = -1;
    } else if (open < 0) open = at;
    at += line.length + 1;
  }

  if (open >= 0) blocks.push({ start: open, text: text.slice(open) });
  return blocks;
};

const piecesOf = ({ text, start }) => {
  const parts = text.split(/(?<=[.!?])(\s+)/);
  const pieces = [];
  let at = start;

  for (let index = 0; index < parts.length; index += 2) {
    const body = parts[index] ?? "";
    pieces.push({ start: at, end: at + body.length, words: counted(body).length });
    at += body.length + (parts[index + 1] ?? "").length;
  }

  return pieces;
};

const CANDIDATES = {
  "no-prose-uses-a-banned-mark": (text) =>
    SETTINGS.marks.flatMap((mark) =>
      [...text.matchAll(new RegExp(spelling(mark), "g"))].map((match) => ({
        start: match.index,
        end: match.index + mark.length,
        what: `the mark "${mark}"`,
      })),
    ),

  "no-prose-uses-a-banned-word": (text) =>
    SETTINGS.words.flatMap(({ word }) =>
      [...text.matchAll(new RegExp(`\\b${word}\\b`, "gi"))].map((match) => ({
        start: match.index,
        end: match.index + match[0].length,
        what: `the word "${match[0]}"`,
      })),
    ),

  "no-passage-runs-past-its-limit": (text) =>
    blocksIn(text)
      .flatMap((block) => piecesOf(block))
      .filter((piece) => piece.words > SETTINGS.maxSentenceWords)
      .map((piece) => ({ ...piece, what: `a sentence of ${piece.words} words` })),

  "no-inline-code-holds-more-than-a-path": (text) =>
    [...text.matchAll(CODE_SPAN)]
      .map((match) => ({ start: match.index, end: match.index + match[0].length, words: counted(match[1]) }))
      .filter(({ words }) => words.length > SETTINGS.maxInlineCodeWords && words.every((one) => PLAIN_WORD.test(one)))
      .map(({ start, end, words }) => ({ start, end, what: `${words.length} words of inline code` })),
};

const reportedIn = (report) => {
  const starts = new Map();

  for (const claim of report.claims ?? []) {
    for (const finding of claim.findings ?? []) {
      const key = `${claim.claim}|${finding.file.split("/").at(-1)}`;
      starts.set(key, [...(starts.get(key) ?? []), finding.start ?? 0]);
    }
  }

  return starts;
};

const unreportedIn = (run, starts) => {
  const unreported = [];
  const counts = new Map();
  const at = join(run, "corpus");

  for (const name of readdirSync(at)) {
    const source = readFileSync(join(at, name), "utf8");
    const text = blankedOut(source);
    const lines = source.split("\n");

    for (const [claim, candidatesOf] of Object.entries(CANDIDATES)) {
      const said = starts.get(`${claim}|${name}`) ?? [];
      const candidates = candidatesOf(text);
      counts.set(claim, (counts.get(claim) ?? 0) + candidates.length);

      for (const candidate of candidates) {
        if (said.some((one) => one >= candidate.start && one < candidate.end)) continue;
        const line = lineAt(source, candidate.start);
        unreported.push({ claim, what: candidate.what, file: name, line, context: windowed(lines, line, false) });
      }
    }
  }

  return { unreported, counts };
};

const sampled = (all) => {
  const perClaim = new Map();
  return all.filter((candidate) => {
    const seen = perClaim.get(candidate.claim) ?? 0;
    perClaim.set(candidate.claim, seen + 1);
    return seen < PER_CLAIM;
  });
};

const asking = (batch) =>
  [
    ...ASKED,
    "",
    ...batch.map((candidate, index) =>
      [
        `## candidate ${index}`,
        `rule: ${candidate.claim}`,
        `looks like: ${candidate.what}`,
        `file: ${candidate.file}, and it stands on line ${candidate.line}`,
        candidate.context,
      ].join("\n"),
    ),
  ].join("\n\n");

const RUN = mkdtempSync(join(tmpdir(), "recall-"));
const pages = markdownIn(CORPUS, PAGES);
projectFor(RUN, pages, CORPUS);

const { unreported, counts } = unreportedIn(RUN, reportedIn(reportIn(RUN)));
const found = sampled(unreported);
const total = [...counts.values()].reduce((sum, one) => sum + one, 0);
say(`recall  ${pages.length} pages · ${total} candidates · ${unreported.length} unreported · ${MODEL}\n`);

measured({
  items: found,
  asking,
  model: MODEL,
  run: RUN,
  batch: BATCH,
  claims: Object.keys(CANDIDATES),
  verdicts: ["quiet", "missed"],
  extra: (claim) => [
    `${counts.get(claim) ?? 0} candidates, ${unreported.filter((one) => one.claim === claim).length} unreported`,
  ],
});
