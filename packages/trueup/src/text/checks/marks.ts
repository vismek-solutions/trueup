import type { Passage, TextIssue } from "../model.ts";
import { maskedProse } from "../spans.ts";

const OPTION = "--";
const BEFORE_AN_OPTION = /[\s"'([]/;
const OPENS_A_NAME = /\p{L}/u;

const opensAnOption = (prose: string, mark: string, at: number): boolean =>
  mark === OPTION &&
  (at === 0 || BEFORE_AN_OPTION.test(prose.charAt(at - 1))) &&
  OPENS_A_NAME.test(prose.charAt(at + OPTION.length));

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
      occurrencesOf(prose, mark)
        .filter((at) => !opensAnOption(prose, mark, at))
        .map((at) => ({
          message: `uses "${mark}" where a full stop, a comma, a colon or a joining word would do`,
          start: passage.start + at,
        })),
    );
  });
