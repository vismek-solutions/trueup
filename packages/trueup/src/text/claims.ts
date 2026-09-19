import type { Claim } from "../claims/model.ts";
import type { Finding, Severity } from "../report/model.ts";
import { documentsIn } from "./documents.ts";
import { inlineCodeIssues } from "./inline.ts";
import { limitIssues } from "./limits.ts";
import { markIssues } from "./marks.ts";
import type { Passage, TextIssue } from "./model.ts";
import { wordIssues, type WordSwap } from "./wording.ts";

export interface TextSettings {
  readonly files: readonly string[];
  readonly marks?: readonly string[] | undefined;
  readonly words?: readonly WordSwap[] | undefined;
  readonly maxSentenceWords?: number | undefined;
  readonly maxParagraphSentences?: number | undefined;
  readonly maxInlineCodeWords?: number | undefined;
}

const MARKS = [
  "A mark the project banned stands in for a pause, which hides which of a full stop, a comma or a colon the sentence actually needed.",
  "",
  "Do this:",
  "- Split the sentence where the mark stands, or put a comma, a colon or a joining word there.",
  "- Put a genuine range or a compound word in inline code, which this check does not read.",
  "",
  "Not the fix: swapping one dash for a narrower one. Every mark the rulebook lists is off, whatever its width.",
].join("\n");

const WORDS = [
  "A word the project banned is in the prose, with a plainer one named beside it in the rulebook.",
  "",
  "Do this:",
  "- Use the replacement the rulebook names.",
  "- Say the sentence a different way, if the replacement does not fit it.",
  "",
  "Not the fix: dropping the word from the list so this passes. The list is what holds the guides to one voice.",
].join("\n");

const LIMITS = [
  "A sentence or a paragraph runs past the limit this project set. No study establishes a length threshold, so the number is a house convention rather than a standard.",
  "",
  "Do this:",
  "- Cut what the sentence does not need. Shortening on its own is measured to buy nothing, so removing a clause beats moving it.",
  "- Keep the joining word if you do split. Deleting it drops the relation the sentence was carrying.",
  "- Break the paragraph where the subject changes, or move the extra sentences into a list.",
  "",
  "Not the fix: raising the limit. The number exists to force the question of what the sentence is for.",
].join("\n");

const INLINE = [
  "Inline code holds a phrase of plain words. Inline code is for a path, a command or a symbol, because a terminal makes those clickable, and a sentence inside it reads as neither code nor prose.",
  "",
  "Do this:",
  "- Take the backticks off and let the words sit in the sentence.",
  "- Give it its own block, if the text really is something to run or open.",
  "",
  "Not the fix: raising the word limit. A path, a command and a symbol all sit under it already.",
].join("\n");

type IssuesOf = (passages: readonly Passage[]) => readonly TextIssue[];

interface TextClaim {
  readonly name: string;
  readonly files: readonly string[];
  readonly severity: Severity;
  readonly issuesOf: IssuesOf;
  readonly guidance: string;
}

const claimOver = ({ name, files, severity, issuesOf, guidance }: TextClaim): Claim => ({
  name,
  check: ({ project }) => ({
    guidance,
    findings: documentsIn(project, files).flatMap(({ file, passages }): readonly Finding[] =>
      issuesOf(passages).map((issue) => ({
        severity,
        message: issue.message,
        file,
        start: issue.start,
      })),
    ),
  }),
});

export function textClaims(settings: TextSettings): readonly Claim[] {
  const { files, marks = [], words = [], maxSentenceWords, maxParagraphSentences } = settings;
  const { maxInlineCodeWords } = settings;
  const bounded = maxSentenceWords !== undefined || maxParagraphSentences !== undefined;

  const wanted: readonly (Omit<TextClaim, "files"> | null)[] = [
    marks.length === 0
      ? null
      : {
          name: "no-prose-uses-a-banned-mark",
          severity: "error",
          issuesOf: (passages) => markIssues(passages, marks),
          guidance: MARKS,
        },
    words.length === 0
      ? null
      : {
          name: "no-prose-uses-a-banned-word",
          severity: "error",
          issuesOf: (passages) => wordIssues(passages, words),
          guidance: WORDS,
        },
    bounded
      ? {
          name: "no-passage-runs-past-its-limit",
          severity: "error",
          issuesOf: (passages) => limitIssues(passages, { maxSentenceWords, maxParagraphSentences }),
          guidance: LIMITS,
        }
      : null,
    maxInlineCodeWords === undefined
      ? null
      : {
          name: "no-inline-code-holds-more-than-a-path",
          severity: "error",
          issuesOf: (passages) => inlineCodeIssues(passages, maxInlineCodeWords),
          guidance: INLINE,
        },
  ];

  return wanted.filter((claim) => claim !== null).map((claim) => claimOver({ ...claim, files }));
}
