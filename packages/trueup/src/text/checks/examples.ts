import type { Measure, Section, TextIssue } from "../model.ts";

export const wordsWithoutExample = (sections: readonly Section[]): readonly Measure[] =>
  sections
    .filter((section) => !section.shows)
    .map((section) => ({ value: section.words, start: section.start }));

export const exampleIssues = (sections: readonly Section[], maxWords: number): readonly TextIssue[] =>
  wordsWithoutExample(sections)
    .filter((measure) => measure.value > maxWords)
    .map((measure) => ({
      message: `runs to ${measure.value} words with nothing to look at, more than the ${maxWords} allowed`,
      start: measure.start,
    }));
