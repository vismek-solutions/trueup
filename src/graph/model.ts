import type { BindingKind } from "../ports/module-record.ts";

export interface SymbolRef {
  readonly path: string;
  readonly name: string;
}

export type EdgeTarget =
  | { readonly kind: "symbol"; readonly path: string; readonly name: string }
  | { readonly kind: "namespace"; readonly path: string }
  | { readonly kind: "external"; readonly path: string | null }
  | { readonly kind: "builtin"; readonly name: string }
  | { readonly kind: "missing-export"; readonly path: string; readonly name: string }
  | { readonly kind: "ambiguous"; readonly candidates: readonly SymbolRef[] };

export interface SymbolImportEdge {
  readonly from: string;
  readonly start: number;
  readonly specifier: string;
  readonly via: string;
  readonly imported: string;
  readonly local: string;
  readonly kind: BindingKind;
  readonly to: EdgeTarget;
}

export interface UnresolvedImport {
  readonly from: string;
  readonly specifier: string;
  readonly start: number;
  readonly reason: string;
}

export interface SymbolGraph {
  readonly files: ReadonlySet<string>;
  readonly edges: readonly SymbolImportEdge[];
  readonly unresolvedImports: readonly UnresolvedImport[];
}

export function consumersOf(graph: SymbolGraph, target: SymbolRef): readonly SymbolImportEdge[] {
  return graph.edges.filter(
    (edge) => edge.to.kind === "symbol" && edge.to.path === target.path && edge.to.name === target.name,
  );
}
