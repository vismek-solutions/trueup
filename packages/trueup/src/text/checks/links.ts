import type { Passage, Span, TextIssue } from "../model.ts";
import { codeSpansIn } from "../spans.ts";

const LINK = /\[([^\]]*)\]\(/g;
const EDGES = /^[\s*_`"']+|[\s*_`"'.,:;!?]+$/g;

const SAYS_NOTHING = new Set([
  "here",
  "click here",
  "see here",
  "this",
  "this page",
  "this link",
  "learn more",
  "read more",
  "more",
  "link",
]);

const inCode = (spans: readonly Span[], at: number): boolean =>
  spans.some((span) => at >= span.start && at < span.end);

export const linkIssues = (passages: readonly Passage[]): readonly TextIssue[] =>
  passages.flatMap((passage) => {
    const spans = codeSpansIn(passage.text);

    return [...passage.text.matchAll(LINK)].flatMap((match): readonly TextIssue[] => {
      const said = match[1] ?? "";
      if (said.startsWith("`") && said.endsWith("`")) return [];
      if (!SAYS_NOTHING.has(said.toLowerCase().replace(EDGES, ""))) return [];
      if (passage.text[match.index - 1] === "!" || inCode(spans, match.index)) return [];

      return [
        {
          message: `links as "${said}", which says nothing about where it goes`,
          start: passage.start + match.index,
        },
      ];
    });
  });
