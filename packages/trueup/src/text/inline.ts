import type { Passage, TextIssue } from "./model.ts";
import { wordsIn } from "./sentences.ts";
import { codeSpansIn } from "./spans.ts";

const PLAIN_WORD = /^[a-z]+$/;

const readsAsProse = (text: string, maxWords: number): boolean => {
  const words = wordsIn(text);
  return words.length > maxWords && words.every((word) => PLAIN_WORD.test(word));
};

export const inlineCodeIssues = (
  passages: readonly Passage[],
  maxWords: number,
): readonly TextIssue[] =>
  passages.flatMap((passage) =>
    codeSpansIn(passage.text)
      .filter((span) => readsAsProse(span.text, maxWords))
      .map((span) => ({
        message: "holds a phrase in inline code, where a path, a command or a symbol belongs",
        start: passage.start + span.start,
      })),
  );
