import type { Span } from "../../ports/span.ts";

const OPENING = /^\/\/+|^\/\*+/;
const CLOSING = /\*+\/$/;
const DECORATION = /^[ \t]*\*+ ?/gm;
const spaces = (marker: string): string => " ".repeat(marker.length);

const spoken = (marked: string): string =>
  marked.replace(OPENING, spaces).replace(CLOSING, spaces).replace(DECORATION, spaces);

// a comment's text keeps the source's length, its markers blanked, so an index into it indexes the file
export const commentsOf = (comments: readonly Pick<Span, "start" | "end">[], text: string): Span[] =>
  comments.map((comment) => ({
    text: spoken(text.slice(comment.start, comment.end)),
    start: comment.start,
    end: comment.end,
  }));
