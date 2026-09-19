import type { Passage, TextIssue } from "../model.ts";
import { maskedProse } from "../spans.ts";

export interface WordSwap {
  readonly word: string;
  readonly instead: string;
}

const METACHARACTER = /[.*+?^${}()|[\]\\]/g;

const wholeWord = (word: string): RegExp => new RegExp(`\\b${word.replace(METACHARACTER, "\\$&")}\\b`, "gi");

export const wordIssues = (passages: readonly Passage[], swaps: readonly WordSwap[]): readonly TextIssue[] =>
  passages.flatMap((passage) => {
    const prose = maskedProse(passage.text);

    return swaps.flatMap((swap) =>
      [...prose.matchAll(wholeWord(swap.word))].map((match) => ({
        message: `uses "${match[0]}" where "${swap.instead}" would do`,
        start: passage.start + match.index,
      })),
    );
  });
