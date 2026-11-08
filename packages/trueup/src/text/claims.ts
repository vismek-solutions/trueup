import type { Claim } from "../claims/model.ts";
import type { Finding, Severity } from "../report/model.ts";
import { documentsIn, matching, type Document, type Surface } from "./documents.ts";
import { exampleIssues } from "./checks/examples.ts";
import { inlineCodeIssues } from "./checks/inline.ts";
import { limitIssues } from "./checks/limits.ts";
import { linkIssues } from "./checks/links.ts";
import { markIssues } from "./checks/marks.ts";
import { assembledIssues } from "./checks/strings.ts";
import type { TextIssue } from "./model.ts";
import { wordIssues, type WordSwap } from "./checks/wording.ts";

export interface TextSettings {
  readonly files: readonly string[];
  readonly comments?: boolean | undefined;
  readonly strings?: readonly string[] | undefined;
  readonly marks?: readonly string[] | undefined;
  readonly words?: readonly WordSwap[] | undefined;
  readonly maxSentenceWords?: number | undefined;
  readonly maxParagraphSentences?: number | undefined;
  readonly maxInlineCodeWords?: number | undefined;
  readonly links?: boolean | undefined;
  readonly maxSectionWordsWithoutExample?: number | undefined;
}

const MARKS = `A mark the project banned stands in for a pause.

Do this:
- Split the sentence where the mark stands, or use a comma, a colon or a joining word.
- Put a genuine range or a compound word in inline code, which this check does not read.

Not the fix: swapping one dash for a narrower one.`;

const WORDS = `A word the project banned is in the prose.

Do this:
- Use the replacement the rulebook names, or say the sentence another way.

Not the fix: dropping the word from the list.`;

const LIMITS = `A sentence or a paragraph runs past the project's limit.

Do this:
- Cut what the sentence does not need, rather than moving it.
- If you split, keep the joining word, which carries the relation.
- Break the paragraph where the subject changes, or move the extra sentences into a list.

Not the fix: raising the limit.`;

const INLINE = `Inline code holds a phrase of plain words. It is for a path, a command or a symbol.

Do this:
- Take the backticks off.
- Give it its own block, if it is something to run or open.

Not the fix: raising the word limit.`;

const LINKS = `A link's text does not say where it goes, and a screen reader can list links without their sentences.

Do this:
- Name the destination in the link text: the page, the command or the setting it explains.
- Move the link onto the words already naming that thing.

Not the fix: writing "click here to read about seams".`;

const EXAMPLES = `A section explains something at length with nothing to look at.

Do this:
- Show the config that switches it on, the report it prints, or the code before and after.
- Capture output by running the tool, never from memory.
- Split the section where the subject changes, if each half stands on its own.

Not the fix: a block that repeats the prose beside it.

This is a warning, so a section with nothing to show can stay.`;

const ASSEMBLED = `A passage is joined from parts when the code runs, so nothing can check it as one passage.

Do this:
- Write the passage as one template literal, keeping its blank lines and its list.
- Build separate messages as an array, with no prose joined between them.

Not the fix: joining with a different separator.`;

type IssuesOf = (document: Document) => readonly TextIssue[];

const assembledClaim = (patterns: readonly string[]): Claim => ({
  name: "no-prose-is-assembled-from-parts",
  check: ({ project }) => ({
    guidance: ASSEMBLED,
    findings: project.files.filter(matching(project, patterns)).flatMap((file): readonly Finding[] =>
      assembledIssues(project.proseIn(file).joined).map((issue) => ({
        severity: "error",
        message: issue.message,
        file,
        start: issue.start,
      })),
    ),
  }),
});

interface TextClaim {
  readonly name: string;
  readonly surface: Surface;
  readonly severity: Severity;
  readonly issuesOf: IssuesOf;
  readonly guidance: string;
}

const claimOver = ({ name, surface, severity, issuesOf, guidance }: TextClaim): Claim => ({
  name,
  check: ({ project }) => ({
    guidance,
    findings: documentsIn(project, surface).flatMap((document): readonly Finding[] =>
      issuesOf(document).map((issue) => ({
        severity,
        message: issue.message,
        file: document.file,
        start: issue.start,
      })),
    ),
  }),
});

export function textClaims(settings: TextSettings): readonly Claim[] {
  const { files, comments = false, strings = [], marks = [], words = [] } = settings;
  const { maxSentenceWords, maxParagraphSentences } = settings;
  const { maxInlineCodeWords, links, maxSectionWordsWithoutExample } = settings;
  const bounded = maxSentenceWords !== undefined || maxParagraphSentences !== undefined;
  const surface: Surface = { files, comments, strings };

  const wanted: readonly (Omit<TextClaim, "surface"> | null)[] = [
    marks.length === 0
      ? null
      : {
          name: "no-prose-uses-a-banned-mark",
          severity: "error",
          issuesOf: ({ passages }) => markIssues(passages, marks),
          guidance: MARKS,
        },
    words.length === 0
      ? null
      : {
          name: "no-prose-uses-a-banned-word",
          severity: "error",
          issuesOf: ({ passages }) => wordIssues(passages, words),
          guidance: WORDS,
        },
    bounded
      ? {
          name: "no-passage-runs-past-its-limit",
          severity: "error",
          issuesOf: ({ passages }) => limitIssues(passages, { maxSentenceWords, maxParagraphSentences }),
          guidance: LIMITS,
        }
      : null,
    maxInlineCodeWords === undefined
      ? null
      : {
          name: "no-inline-code-holds-more-than-a-path",
          severity: "error",
          issuesOf: ({ passages }) => inlineCodeIssues(passages, maxInlineCodeWords),
          guidance: INLINE,
        },
    links === true
      ? {
          name: "every-link-says-where-it-goes",
          severity: "error",
          issuesOf: ({ passages }) => linkIssues(passages),
          guidance: LINKS,
        }
      : null,
    maxSectionWordsWithoutExample === undefined
      ? null
      : {
          name: "every-long-section-shows-an-example",
          severity: "warning",
          issuesOf: ({ sections }) => exampleIssues(sections, maxSectionWordsWithoutExample),
          guidance: EXAMPLES,
        },
  ];

  return [
    ...wanted.filter((claim) => claim !== null).map((claim) => claimOver({ ...claim, surface })),
    ...(strings.length === 0 ? [] : [assembledClaim(strings)]),
  ];
}
