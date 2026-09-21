import type { JoinedProse } from "../../ports/module-record.ts";
import type { TextIssue } from "../model.ts";
import { wordsIn } from "../sentences.ts";

const CODE = /[/\\*{}<>=|$_@#`[\]]/;
const OPENS_A_WORD = /^[A-Za-z]/;
const LEAST_WORDS = 4;

export const looksLikeProse = (text: string): boolean => {
  const words = wordsIn(text);

  return (
    words.filter((word) => OPENS_A_WORD.test(word)).length >= LEAST_WORDS &&
    !words.some((word) => CODE.test(word))
  );
};

export const assembledIssues = (joined: readonly JoinedProse[]): readonly TextIssue[] =>
  joined
    .filter((group) => group.parts.filter((part) => looksLikeProse(part.text)).length >= 2)
    .map((group) => ({
      message: "builds a passage from parts, where one whole string would read as the text it is",
      start: group.start,
    }));
