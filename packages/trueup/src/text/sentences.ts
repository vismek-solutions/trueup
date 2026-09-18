import type { Span } from "./model.ts";

const TERMINAL = /[.!?]/;
const OPENS_A_SENTENCE = /[A-Z0-9`[*_"(]/;
const GAP_THEN_CHARACTER = /^[*_)"]*\s+(\S)/;
const LAST_WORD = /\S*$/;
const ABBREVIATIONS = new Set(["etc.", "vs.", "cf.", "no.", "al.", "fig."]);

const abbreviated = (text: string, at: number): boolean => {
  const word = (LAST_WORD.exec(text.slice(0, at))?.[0] ?? "").toLowerCase();
  return word.includes(".") || ABBREVIATIONS.has(`${word}.`);
};

export function sentencesIn(text: string): readonly Span[] {
  const spans: Span[] = [];
  let start = 0;

  for (let at = 0; at < text.length; at += 1) {
    const character = text[at];
    if (character === undefined || !TERMINAL.test(character)) continue;

    const gap = GAP_THEN_CHARACTER.exec(text.slice(at + 1));
    if (gap === null || !OPENS_A_SENTENCE.test(gap[1] ?? "")) continue;
    if (character === "." && abbreviated(text, at)) continue;

    const end = at + 1;
    spans.push({ text: text.slice(start, end), start, end });
    start = end + gap[0].length - 1;
  }

  if (text.slice(start).trim() !== "") {
    spans.push({ text: text.slice(start), start, end: text.length });
  }

  return spans;
}

export const wordsIn = (text: string): readonly string[] =>
  text.split(/\s+/).filter((word) => word !== "");
