import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROSE, lineAt, markdownIn, projectFor, reportIn, say, windowed } from "../support/corpus.mjs";
import { measured } from "../support/tally.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const MODEL = process.env.PRECISION_MODEL ?? "claude-sonnet-5";
const CORPUS = process.env.PRECISION_CORPUS ?? join(ROOT, "node_modules/.pnpm");
const PAGES = Number(process.env.PRECISION_PAGES ?? 600);
const PER_CLAIM = Number(process.env.PRECISION_PER_CLAIM ?? 30);
const BATCH = 25;

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

const foundIn = (report) =>
  (report.claims ?? [])
    .filter((claim) => PROSE.has(claim.claim))
    .flatMap((claim) =>
      (claim.findings ?? []).map((finding) => {
        const source = readFileSync(finding.file, "utf8");
        const at = lineAt(source, finding.start ?? 0);

        return {
          claim: claim.claim,
          message: finding.message,
          file: (finding.file ?? "").split("/").at(-1) ?? "",
          line: at,
          context: windowed(source.split("\n"), at, claim.claim === "every-long-section-shows-an-example"),
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

const asking = (batch) =>
  [
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

const RUN = mkdtempSync(join(tmpdir(), "precision-"));
const pages = markdownIn(CORPUS, PAGES);
projectFor(RUN, pages, CORPUS);

const found = sampled(foundIn(reportIn(RUN)));
say(`precision  ${pages.length} pages · ${found.length} findings · ${MODEL}\n`);

measured({
  items: found,
  asking,
  model: MODEL,
  run: RUN,
  batch: BATCH,
  claims: PROSE,
  verdicts: ["right", "wrong"],
});
