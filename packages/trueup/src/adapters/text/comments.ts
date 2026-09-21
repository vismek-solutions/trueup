import { parseSync } from "oxc-parser";
import type { ReadComments } from "../../ports/module-record.ts";

const OPENING = /^\/\/+|^\/\*+/;
const CLOSING = /\*+\/$/;
const DECORATION = /^[ \t]*\*+ ?/gm;
const spaces = (marker: string): string => " ".repeat(marker.length);

const spoken = (marked: string): string =>
  marked.replace(OPENING, spaces).replace(CLOSING, spaces).replace(DECORATION, spaces);

export const readComments: ReadComments = (path, text) =>
  parseSync(path, text).comments.map((comment) => ({
    text: spoken(text.slice(comment.start, comment.end)),
    start: comment.start,
    end: comment.end,
  }));
