import { DEFAULT, type ModuleRecord } from "../ports/module-record.ts";
import type { ResolveSpecifier } from "../ports/resolve.ts";
import type { EdgeTarget, SymbolRef } from "./model.ts";

export interface ExportResolverDeps {
  readonly modules: ReadonlyMap<string, ModuleRecord>;
  readonly resolve: ResolveSpecifier;
}

export type ResolveExport = (path: string, name: string) => EdgeTarget;

const keyOf = (path: string, name: string): string => `${path}\0${name}`;

const identityOf = (target: EdgeTarget): string => {
  switch (target.kind) {
    case "symbol":
      return `symbol\0${target.path}\0${target.name}`;
    case "namespace":
      return `namespace\0${target.path}`;
    case "external":
      return `external\0${target.path ?? ""}`;
    case "builtin":
      return `builtin\0${target.name}`;
    case "missing-export":
      return `missing\0${target.path}\0${target.name}`;
    case "ambiguous":
      return `ambiguous\0${target.candidates.map((c) => `${c.path}:${c.name}`).join("|")}`;
  }
};

const asRef = (target: EdgeTarget): SymbolRef | null =>
  target.kind === "symbol" ? { path: target.path, name: target.name } : null;

interface Reach {
  readonly candidates: readonly EdgeTarget[];
  readonly sawUnknownSource: boolean;
}

const settle = (path: string, name: string, { candidates, sawUnknownSource }: Reach): EdgeTarget => {
  const first = candidates[0];
  if (first === undefined) {
    return sawUnknownSource ? { kind: "external", path: null } : { kind: "missing-export", path, name };
  }
  if (candidates.length === 1) return first;

  return {
    kind: "ambiguous",
    candidates: candidates.map(asRef).filter((ref): ref is SymbolRef => ref !== null),
  };
};

export function createExportResolver({ modules, resolve }: ExportResolverDeps): ResolveExport {
  const memo = new Map<string, EdgeTarget>();
  const visiting = new Set<string>();

  const step = (path: string, name: string): EdgeTarget => {
    const key = keyOf(path, name);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    if (visiting.has(key)) return { kind: "missing-export", path, name };

    visiting.add(key);
    const result = compute(path, name);
    visiting.delete(key);
    memo.set(key, result);
    return result;
  };

  const follow = (fromFile: string, specifier: string, name: string): EdgeTarget => {
    const resolution = resolve(fromFile, specifier);
    if (resolution.kind === "builtin") return { kind: "builtin", name: resolution.name };
    if (resolution.kind === "unresolved" || resolution.kind === "external") {
      return { kind: "external", path: null };
    }
    if (!modules.has(resolution.path)) return { kind: "external", path: resolution.path };
    return step(resolution.path, name);
  };

  const namespaceOf = (path: string, specifier: string): EdgeTarget => {
    const resolution = resolve(path, specifier);
    return resolution.kind === "path"
      ? { kind: "namespace", path: resolution.path }
      : { kind: "external", path: null };
  };

  const declared = (path: string, record: ModuleRecord, name: string): EdgeTarget | null => {
    for (const entry of record.exports) {
      if (entry.form === "local" && entry.exported === name) {
        return { kind: "symbol", path, name: entry.local };
      }
      if (entry.form === "re-export-named" && entry.exported === name) {
        return follow(path, entry.specifier, entry.imported);
      }
      if (entry.form === "re-export-namespace" && entry.exported === name) {
        return namespaceOf(path, entry.specifier);
      }
    }

    return null;
  };

  const acrossStars = (path: string, record: ModuleRecord, name: string): Reach => {
    const reached = new Map<string, EdgeTarget>();
    let sawUnknownSource = false;

    for (const entry of record.exports) {
      if (entry.form !== "re-export-star") continue;

      const target = follow(path, entry.specifier, name);
      if (target.kind === "missing-export" || target.kind === "builtin") continue;
      if (target.kind === "external") sawUnknownSource = true;
      else reached.set(identityOf(target), target);
    }

    return { candidates: [...reached.values()], sawUnknownSource };
  };

  const compute = (path: string, name: string): EdgeTarget => {
    const record = modules.get(path);
    if (record === undefined) return { kind: "external", path };

    const found = declared(path, record, name);
    if (found !== null) return found;
    if (name === DEFAULT) return { kind: "missing-export", path, name };

    return settle(path, name, acrossStars(path, record, name));
  };

  return step;
}
