import type { Passage, TextIssue } from "./model.ts";
import { sentencesIn } from "./sentences.ts";
import { maskedProse } from "./spans.ts";

const WORD = /[a-z]+/g;
const SHORTEST_CONTENT_WORD = 3;
const FEWEST_COMPARABLE_WORDS = 3;

const STOPWORDS = new Set([
  "and", "are", "but", "can", "for", "from", "had", "has", "have", "how", "into", "its", "not",
  "onto", "over", "own", "que", "she", "so", "some", "such", "than", "that", "the", "their",
  "them", "then", "there", "these", "they", "this", "those", "through", "too", "under", "very",
  "was", "way", "were", "what", "when", "where", "which", "while", "who", "why", "will", "with",
  "would", "you", "your",
]);

const contentWordsIn = (text: string): ReadonlySet<string> =>
  new Set(
    [...text.toLowerCase().matchAll(WORD)]
      .map((match) => match[0])
      .filter((word) => word.length >= SHORTEST_CONTENT_WORD && !STOPWORDS.has(word)),
  );

const overlapOf = (left: ReadonlySet<string>, right: ReadonlySet<string>): number => {
  const shared = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;

  return union === 0 ? 0 : shared / union;
};

export function echoIssues(passages: readonly Passage[], threshold: number): readonly TextIssue[] {
  return passages.flatMap((passage) => {
    const sentences = sentencesIn(maskedProse(passage.text));
    const issues: TextIssue[] = [];
    let before: ReadonlySet<string> | null = null;

    for (const sentence of sentences) {
      const words = contentWordsIn(sentence.text);
      const restates =
        before !== null &&
        before.size >= FEWEST_COMPARABLE_WORDS &&
        words.size >= FEWEST_COMPARABLE_WORDS &&
        overlapOf(before, words) >= threshold;

      if (restates) {
        issues.push({ message: "restates the sentence before it", start: passage.start + sentence.start });
      }

      before = words;
    }

    return issues;
  });
}
