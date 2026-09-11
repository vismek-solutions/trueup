import type { EdgeTarget } from "../graph/model.ts";
import type { Vocabulary } from "../lexicon/model.ts";
import type { BindingKind, Declaration, Mention } from "../ports/module-record.ts";
import type { Severity } from "../report/model.ts";
import type { ZoneRole } from "../zones/model.ts";

export interface ResolvedImport {
  readonly from: string;
  readonly fromZone: string | null;
  readonly specifier: string;
  readonly via: string;
  readonly viaZone: string | null;
  readonly imported: string;
  readonly local: string;
  readonly kind: BindingKind;
  readonly symbol: string | null;
  readonly declaredIn: string | null;
  readonly declaredZone: string | null;
  readonly at: number;
  readonly target: EdgeTarget;
}

export interface ImportQuery {
  readonly fromZone?: string | undefined;
  readonly declaredZone?: string | undefined;
  readonly kind?: BindingKind | undefined;
}

export interface Issue {
  readonly message: string;
  readonly file?: string | undefined;
  readonly at?: number | undefined;
  readonly severity?: Severity | undefined;
}

export interface Project {
  readonly root: string;
  readonly files: readonly string[];
  readonly zoneNames: readonly string[];
  readonly zoneOf: (file: string) => string | null;
  readonly roleOf: (zone: string) => ZoneRole | null;
  readonly filesIn: (zone: string) => readonly string[];
  readonly imports: (query?: ImportQuery) => readonly ResolvedImport[];
  readonly exportsOf: (file: string) => readonly string[];
  readonly sourceOf: (file: string) => string | null;
  readonly mentionsIn: (file: string) => readonly Mention[];
  readonly declarationsIn: (file: string) => readonly Declaration[];
  readonly referencesIn: (file: string) => ReadonlyMap<string, ReadonlySet<string>>;
  readonly importsWithin: (file: string, names: readonly string[]) => readonly ResolvedImport[];
  readonly reachedWithin: (file: string, names: readonly string[]) => readonly string[];
  readonly vocabularyOf: (zones: readonly string[]) => Vocabulary;
  readonly relative: (file: string) => string;
}
