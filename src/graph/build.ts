import { NAMESPACE, type ModuleRecord } from "../ports/module-record.ts";
import type { Resolution, ResolveSpecifier } from "../ports/resolve.ts";
import { createExportResolver, type ResolveExport } from "./exports.ts";
import type { SymbolGraph, SymbolImportEdge, UnresolvedImport } from "./model.ts";

export interface BuildSymbolGraphDeps {
  readonly modules: readonly ModuleRecord[];
  readonly resolve: ResolveSpecifier;
}

type Located = Exclude<Resolution, { readonly kind: "unresolved" }>;

interface Known {
  readonly holds: (path: string) => boolean;
  readonly resolveExport: ResolveExport;
}

const targetOf = (resolution: Located, imported: string, known: Known): SymbolImportEdge["to"] => {
  if (resolution.kind === "builtin") return { kind: "builtin", name: resolution.name };
  if (resolution.kind === "external") return { kind: "external", path: null };
  if (!known.holds(resolution.path)) return { kind: "external", path: resolution.path };
  if (imported === NAMESPACE) return { kind: "namespace", path: resolution.path };
  return known.resolveExport(resolution.path, imported);
};

export function buildSymbolGraph({ modules, resolve }: BuildSymbolGraphDeps): SymbolGraph {
  const byPath = new Map(modules.map((record) => [record.path, record]));
  const resolveExport = createExportResolver({ modules: byPath, resolve });

  const known: Known = { holds: (path) => byPath.has(path), resolveExport };
  const edges: SymbolImportEdge[] = [];
  const unresolvedImports: UnresolvedImport[] = [];

  for (const record of modules) {
    for (const statement of record.imports) {
      const resolution = resolve(record.path, statement.specifier);

      if (resolution.kind === "unresolved") {
        unresolvedImports.push({
          from: record.path,
          specifier: statement.specifier,
          start: statement.start,
          reason: resolution.reason,
        });
        continue;
      }

      const via = resolution.kind === "path" ? resolution.path : statement.specifier;

      for (const binding of statement.bindings) {
        edges.push({
          from: record.path,
          start: binding.start,
          specifier: statement.specifier,
          via,
          imported: binding.imported,
          local: binding.local,
          kind: binding.kind,
          to: targetOf(resolution, binding.imported, known),
        });
      }
    }
  }

  return { files: new Set(byPath.keys()), edges, unresolvedImports };
}
