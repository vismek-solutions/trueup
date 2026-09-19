import type { Claim } from "../claims/model.ts";
import type { Finding, Severity } from "../report/model.ts";
import { documentsIn } from "./documents.ts";
import { inlineCodeIssues } from "./checks/inline.ts";
import { limitIssues } from "./checks/limits.ts";
import { linkIssues } from "./checks/links.ts";
import { markIssues } from "./checks/marks.ts";
import type { Passage, TextIssue } from "./model.ts";
import { wordIssues, type WordSwap } from "./checks/wording.ts";

export interface TextSettings {
  readonly files: readonly string[];
  readonly marks?: readonly string[] | undefined;
  readonly words?: readonly WordSwap[] | undefined;
  readonly maxSentenceWords?: number | undefined;
  readonly maxParagraphSentences?: number | undefined;
  readonly maxInlineCodeWords?: number | undefined;
  readonly links?: boolean | undefined;
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

const LINKS = [
  'A link says nothing about where it goes. Somebody reading with a screen reader can pull up a page\'s links as a list, out of the sentences around them, and a list of "here" and "this page" leads nowhere. WCAG 2.4.4 puts this at the strictest level.',
  "",
  "Do this:",
  "- Name the destination in the link text: the page, the command or the setting it explains.",
  "- Move the link onto the words already naming that thing, so the sentence keeps its shape.",
  "",
  'Not the fix: writing "click here to read about seams". The link text is read on its own, so the rest of the sentence is not there to carry it.',
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
  const { maxInlineCodeWords, links } = settings;
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
    links === true
      ? {
          name: "every-link-says-where-it-goes",
          severity: "error",
          issuesOf: linkIssues,
          guidance: LINKS,
        }
      : null,
  ];

  return wanted.filter((claim) => claim !== null).map((claim) => claimOver({ ...claim, files }));
}
