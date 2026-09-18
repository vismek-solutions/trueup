import type { Passage, TextIssue } from "./model.ts";
import { sentencesIn, wordsIn } from "./sentences.ts";
import { maskedProse } from "./spans.ts";

export interface Limits {
  readonly maxSentenceWords?: number | undefined;
  readonly maxParagraphSentences?: number | undefined;
}

export function limitIssues(passages: readonly Passage[], limits: Limits): readonly TextIssue[] {
  const { maxSentenceWords, maxParagraphSentences } = limits;

  return passages.flatMap((passage) => {
    const sentences = sentencesIn(maskedProse(passage.text));
    const issues: TextIssue[] = [];

    if (
      maxParagraphSentences !== undefined &&
      passage.kind === "paragraph" &&
      sentences.length > maxParagraphSentences
    ) {
      issues.push({
        message: `runs to ${sentences.length} sentences, more than the ${maxParagraphSentences} allowed`,
        start: passage.start,
      });
    }

    if (maxSentenceWords === undefined) return issues;

    for (const sentence of sentences) {
      const words = wordsIn(passage.text.slice(sentence.start, sentence.end)).length;
      if (words <= maxSentenceWords) continue;

      issues.push({
        message: `runs to ${words} words in one sentence, more than the ${maxSentenceWords} allowed`,
        start: passage.start + sentence.start,
      });
    }

    return issues;
  });
}
