import type { Passage, TextIssue } from "../model.ts";
import { maskedProse } from "../spans.ts";

const occurrencesOf = (prose: string, mark: string): readonly number[] => {
  const found: number[] = [];
  let at = prose.indexOf(mark);

  while (at !== -1) {
    found.push(at);
    at = prose.indexOf(mark, at + mark.length);
  }

  return found;
};

export const markIssues = (passages: readonly Passage[], marks: readonly string[]): readonly TextIssue[] =>
  passages.flatMap((passage) => {
    const prose = maskedProse(passage.text);

    return marks.flatMap((mark) =>
      occurrencesOf(prose, mark).map((at) => ({
        message: `uses "${mark}" where a full stop, a comma, a colon or a joining word would do`,
        start: passage.start + at,
      })),
    );
  });
