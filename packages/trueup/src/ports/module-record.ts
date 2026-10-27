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

export interface Declaration {
  readonly name: string;
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

export interface SourceFacts {
  readonly record: ModuleRecord;
  readonly mentions: readonly Mention[];
  readonly declarations: readonly Declaration[];
  readonly comments: readonly Span[];
}

export type ParseSource = (path: string, text: string) => SourceFacts;

export type ParseSources = (sources: ReadonlyMap<string, string>) => ReadonlyMap<string, SourceFacts>;

export interface JoinedProse {
  readonly parts: readonly Span[];
  readonly start: number;
}

export interface ProseInCode {
  readonly strings: readonly Span[];
  readonly joined: readonly JoinedProse[];
}

export type ReadProse = (path: string, text: string) => ProseInCode;
