import type { Measure, Passage, TextIssue } from "../model.ts";
import { sentencesIn, wordsIn } from "../sentences.ts";
import { maskedProse } from "../spans.ts";

export interface Limits {
  readonly maxSentenceWords?: number | undefined;
  readonly maxParagraphSentences?: number | undefined;
}

export const paragraphSentences = (passages: readonly Passage[]): readonly Measure[] =>
  passages
    .filter((passage) => passage.kind === "paragraph")
    .map((passage) => ({
      value: sentencesIn(maskedProse(passage.text)).length,
      start: passage.start,
    }));

export const sentenceWords = (passages: readonly Passage[]): readonly Measure[] =>
  passages.flatMap((passage) =>
    sentencesIn(maskedProse(passage.text)).map((sentence) => ({
      value: wordsIn(passage.text.slice(sentence.start, sentence.end)).length,
      start: passage.start + sentence.start,
    })),
  );

type Wording = (value: number, limit: number) => string;

const over = (measures: readonly Measure[], limit: number | undefined, said: Wording): TextIssue[] =>
  limit === undefined
    ? []
    : measures
        .filter((measure) => measure.value > limit)
        .map((measure) => ({ message: said(measure.value, limit), start: measure.start }));

export function limitIssues(passages: readonly Passage[], limits: Limits): readonly TextIssue[] {
  const { maxSentenceWords, maxParagraphSentences } = limits;

  return [
    ...over(
      paragraphSentences(passages),
      maxParagraphSentences,
      (value, limit) => `runs to ${value} sentences, more than the ${limit} allowed`,
    ),
    ...over(
      sentenceWords(passages),
      maxSentenceWords,
      (value, limit) => `runs to ${value} words in one sentence, more than the ${limit} allowed`,
    ),
  ].sort((left, right) => left.start - right.start);
}
