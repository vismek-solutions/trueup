import type { Span } from "./span.ts";

export type BindingKind = "value" | "type";

export const NAMESPACE = "*";
export const DEFAULT = "default";

export interface ImportBinding {
  readonly imported: string;
  readonly local: string;
  readonly kind: BindingKind;
  readonly start: number;
}

export interface ImportStatement {
  readonly specifier: string;
  readonly start: number;
  readonly bindings: readonly ImportBinding[];
}

export type ExportEntry =
  | {
      readonly form: "local";
      readonly exported: string;
      readonly local: string;
      readonly kind: BindingKind;
      readonly start: number;
    }
  | {
      readonly form: "re-export-named";
      readonly exported: string;
      readonly imported: string;
      readonly specifier: string;
      readonly kind: BindingKind;
      readonly start: number;
    }
  | {
      readonly form: "re-export-namespace";
      readonly exported: string;
      readonly specifier: string;
      readonly kind: BindingKind;
      readonly start: number;
    }
  | {
      readonly form: "re-export-star";
      readonly specifier: string;
      readonly kind: BindingKind;
      readonly start: number;
    };

export type MentionForm = "name" | "string";

export interface Mention {
  readonly text: string;
  readonly form: MentionForm;
  readonly start: number;
}

export interface ModuleRecord {
  readonly path: string;
  readonly imports: readonly ImportStatement[];
  readonly exports: readonly ExportEntry[];
  readonly esm: boolean;
}

export type ParseModule = (path: string, text: string) => ModuleRecord;

export type ReadMentions = (path: string, text: string) => readonly Mention[];

export interface Declaration {
  readonly name: string;
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

export type ReadDeclarations = (path: string, text: string) => readonly Declaration[];

// a comment's text keeps the source's length, its markers blanked, so an index into it indexes the file
export type ReadComments = (path: string, text: string) => readonly Span[];
