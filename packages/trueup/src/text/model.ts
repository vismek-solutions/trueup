export type PassageKind = "heading" | "paragraph" | "item";

export interface Passage {
  readonly kind: PassageKind;
  readonly text: string;
  readonly start: number;
}

export interface Span {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

export interface Measure {
  readonly value: number;
  readonly start: number;
}

export interface TextIssue {
  readonly message: string;
  readonly start: number;
}
