import { NAMESPACE, type ModuleRecord } from "../ports/module-record.ts";
import type { ResolveSpecifier } from "../ports/resolve.ts";
import { createExportResolver } from "./exports.ts";
import type { SymbolGraph, SymbolImportEdge, UnresolvedImport } from "./model.ts";

export interface BuildSymbolGraphDeps {
  readonly modules: readonly ModuleRecord[];
  readonly resolve: ResolveSpecifier;
}

export function buildSymbolGraph({ modules, resolve }: BuildSymbolGraphDeps): SymbolGraph {
  const byPath = new Map(modules.map((record) => [record.path, record]));
  const resolveExport = createExportResolver({ modules: byPath, resolve });

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
      const isInternal = resolution.kind === "path" && byPath.has(resolution.path);

      for (const binding of statement.bindings) {
        const to = ((): SymbolImportEdge["to"] => {
          if (resolution.kind === "builtin") return { kind: "builtin", name: resolution.name };
          if (!isInternal) return { kind: "external", path: resolution.path };
          if (binding.imported === NAMESPACE) return { kind: "namespace", path: resolution.path };
          return resolveExport(resolution.path, binding.imported);
        })();

        edges.push({
          from: record.path,
          start: binding.start,
          specifier: statement.specifier,
          via,
          imported: binding.imported,
          local: binding.local,
          kind: binding.kind,
          to,
        });
      }
    }
  }

  return { files: new Set(byPath.keys()), edges, unresolvedImports };
}
