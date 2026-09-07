import { dirname } from "node:path";
import { ResolverFactory } from "oxc-resolver";
import type { Resolution, ResolveSpecifier } from "../ports/resolve.ts";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"];

type ResolvedFile = ReturnType<ResolverFactory["resolveFileSync"]>;

const resolutionOf = (result: ResolvedFile, specifier: string): Resolution => {
  if (result.builtin !== undefined && result.builtin !== null) return { kind: "builtin", name: specifier };
  if (result.path !== undefined && result.path !== null) return { kind: "path", path: result.path };
  return { kind: "unresolved", reason: result.error ?? "not resolved" };
};

export function createResolver(): ResolveSpecifier {
  const factory = new ResolverFactory({
    tsconfig: "auto",
    builtinModules: true,
    extensions: SOURCE_EXTENSIONS,
    conditionNames: ["import", "module", "node", "default"],
    mainFields: ["module", "main"],
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    },
  });

  const cache = new Map<string, Resolution>();

  return (fromFile, specifier) => {
    const key = `${dirname(fromFile)}\0${specifier}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const resolution = resolutionOf(factory.resolveFileSync(fromFile, specifier), specifier);
    cache.set(key, resolution);
    return resolution;
  };
}
