import type { Measure, Passage, TextIssue } from "../model.ts";
import { wordsIn } from "../sentences.ts";
import { codeSpansIn } from "../spans.ts";

const PLAIN_WORD = /^[a-z]+$/;

export const proseSpanWords = (passages: readonly Passage[]): readonly Measure[] =>
  passages.flatMap((passage) =>
    codeSpansIn(passage.text)
      .map((span) => ({ words: wordsIn(span.text), start: passage.start + span.start }))
      .filter(({ words }) => words.every((word) => PLAIN_WORD.test(word)))
      .map(({ words, start }) => ({ value: words.length, start })),
  );

export const inlineCodeIssues = (passages: readonly Passage[], maxWords: number): readonly TextIssue[] =>
  proseSpanWords(passages)
    .filter((measure) => measure.value > maxWords)
    .map((measure) => ({
      message: "holds a phrase in inline code, where a path, a command or a symbol belongs",
      start: measure.start,
    }));
