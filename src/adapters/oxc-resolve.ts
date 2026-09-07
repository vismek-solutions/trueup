import { dirname } from "node:path";
import { ResolverFactory } from "oxc-resolver";
import type { ResolveSpecifier } from "../ports/resolve.js";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"];

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

  const cache = new Map<string, ReturnType<ResolveSpecifier>>();

  return (fromFile, specifier) => {
    const key = `${dirname(fromFile)} ${specifier}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const result = factory.resolveFileSync(fromFile, specifier);
    const resolution: ReturnType<ResolveSpecifier> =
      result.builtin !== undefined && result.builtin !== null
        ? { kind: "builtin", name: specifier }
        : result.path !== undefined && result.path !== null
          ? { kind: "path", path: result.path }
          : { kind: "unresolved", reason: result.error ?? "not resolved" };

    cache.set(key, resolution);
    return resolution;
  };
}
