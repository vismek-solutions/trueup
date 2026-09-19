import type { Span } from "./model.ts";

const LINK_TARGET = /\]\([^)]*\)/g;
const URL = /https?:\/\/\S+/g;

export function codeSpansIn(text: string): readonly Span[] {
  const spans: Span[] = [];
  let index = 0;

  while (index < text.length) {
    if (text[index] !== "`") {
      index += 1;
      continue;
    }

    const opened = index;
    while (text[index] === "`") index += 1;

    const marker = text.slice(opened, index);
    const closed = text.indexOf(marker, index);
    if (closed === -1) break;

    spans.push({ text: text.slice(index, closed), start: opened, end: closed + marker.length });
    index = closed + marker.length;
  }

  return spans;
}

// masking keeps the length, so an index into the result is still an index into the original
// the fill is a capital, so a span standing where a sentence opens still reads as one
const FILL = "X";

export function maskedProse(text: string): string {
  const characters = text.split("");

  const blank = (start: number, end: number): void => {
    for (let at = start; at < end && at < characters.length; at += 1) characters[at] = FILL;
  };

  for (const span of codeSpansIn(text)) blank(span.start, span.end);
  for (const pattern of [LINK_TARGET, URL]) {
    for (const match of text.matchAll(pattern)) blank(match.index, match.index + match[0].length);
  }

  return characters.join("");
}
