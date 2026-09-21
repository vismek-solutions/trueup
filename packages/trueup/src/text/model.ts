export type PassageKind = "heading" | "paragraph" | "item";

export interface Passage {
  readonly kind: PassageKind;
  readonly text: string;
  readonly start: number;
}

export interface Section {
  readonly start: number;
  readonly words: number;
  readonly shows: boolean;
}

export type { Span } from "../ports/span.ts";

export interface Measure {
  readonly value: number;
  readonly start: number;
}

export interface TextIssue {
  readonly message: string;
  readonly start: number;
}
