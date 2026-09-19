import type { Passage, Section } from "./model.ts";
import { wordsIn } from "./sentences.ts";

interface Line {
  readonly text: string;
  readonly start: number;
}

type LineKind = "fence" | "skip" | "heading" | "item" | "prose";
type MarkedKind = Exclude<LineKind, "fence">;

interface Marked {
  readonly kind: MarkedKind;
  readonly line: Line;
}

const FENCE = /^ {0,3}(?:`{3,}|~{3,})/;
const HEADING = /^ {0,3}#{1,6} +/;
const ITEM = /^ *(?:[-*+] +|\d+[.)] +)/;
const RULE = /^ {0,3}(?:-{3,}|\*{3,}|_{3,}|={2,}) *$/;
const SKIPPED = /^ *(?:\||>|<|\[[^\]]+\]: )/;
const BLANK = /^ *$/;

const linesOf = (source: string): readonly Line[] => {
  const lines: Line[] = [];
  let start = 0;

  for (const text of source.split("\n")) {
    lines.push({ text, start });
    start += text.length + 1;
  }

  return lines;
};

const bodyFrom = (lines: readonly Line[]): number => {
  const [first] = lines;
  if (first === undefined || first.text.trim() !== "---") return 0;

  const closing = lines.slice(1).find((line) => line.text.trim() === "---");
  return closing === undefined ? 0 : closing.start + closing.text.length + 1;
};

const kindOf = (text: string): LineKind => {
  if (FENCE.test(text)) return "fence";
  if (BLANK.test(text) || RULE.test(text) || SKIPPED.test(text)) return "skip";
  if (HEADING.test(text)) return "heading";
  return ITEM.test(text) ? "item" : "prose";
};

const markerIn = (kind: "heading" | "item", text: string): number =>
  (kind === "heading" ? HEADING.exec(text) : ITEM.exec(text))?.[0].length ?? 0;

const opensComment = (text: string): boolean => {
  const at = text.lastIndexOf("<!--");
  return at !== -1 && !text.slice(at).includes("-->");
};

const markedLines = (lines: readonly Line[]): readonly Marked[] => {
  const body = bodyFrom(lines);
  const marked: Marked[] = [];
  let fenced = false;
  let commented = false;

  for (const line of lines) {
    if (line.start < body) continue;

    if (commented) {
      commented = !line.text.includes("-->");
      marked.push({ kind: "skip", line });
      continue;
    }

    const kind = kindOf(line.text);
    if (kind === "fence") fenced = !fenced;
    commented = !fenced && opensComment(line.text);
    marked.push({ kind: kind === "fence" || fenced ? "skip" : kind, line });
  }

  return marked;
};

const TABLE = /^ *\|/;

const showsSomething = (text: string): boolean => FENCE.test(text) || TABLE.test(text);

export function sectionsIn(source: string): readonly Section[] {
  const sections: Section[] = [];
  let open = { start: 0, words: 0, shows: false };

  for (const { kind, line } of markedLines(linesOf(source))) {
    if (kind === "heading") {
      sections.push(open);
      open = { start: line.start, words: 0, shows: false };
    } else if (kind === "item" || showsSomething(line.text)) {
      open.shows = true;
    } else if (kind === "prose") {
      open.words += wordsIn(line.text).length;
    }
  }

  sections.push(open);
  return sections;
}

// every passage is a contiguous slice, so an index into its text plus its start is a source offset
export function passagesIn(source: string): readonly Passage[] {
  const passages: Passage[] = [];
  let openStart = -1;
  let openEnd = -1;

  const closeParagraph = (): void => {
    if (openStart >= 0) {
      passages.push({ kind: "paragraph", text: source.slice(openStart, openEnd), start: openStart });
    }
    openStart = -1;
  };

  for (const { kind, line } of markedLines(linesOf(source))) {
    const end = line.start + line.text.length;

    if (kind === "prose") {
      if (openStart < 0) openStart = line.start;
      openEnd = end;
      continue;
    }

    closeParagraph();
    if (kind === "skip") continue;

    const start = line.start + markerIn(kind, line.text);
    passages.push({ kind, text: source.slice(start, end), start });
  }

  closeParagraph();
  return passages;
}
