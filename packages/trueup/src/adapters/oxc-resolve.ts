import { dirname } from "node:path";
import { ResolverFactory } from "oxc-resolver";
import type { Resolution, ResolveSpecifier } from "../ports/resolve.ts";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"];

type ResolvedFile = ReturnType<ResolverFactory["resolveFileSync"]>;

const resolutionOf = (result: ResolvedFile, specifier: string): Resolution => {
  if (result.builtin !== undefined) return { kind: "builtin", name: specifier };
  if (result.path !== undefined) return { kind: "path", path: result.path };
  return { kind: "unresolved", reason: result.error ?? "not resolved" };
};

export interface ResolverOptions {
  readonly externals?: readonly string[] | undefined;
}

const OWN_FILE = /^[./]/;
const SPECIAL = /[.*+?^${}()|[\]\\]/g;

const suppliedBy = (patterns: readonly string[]): ((specifier: string) => boolean) => {
  if (patterns.length === 0) return () => false;

  const alternatives = patterns
    .map((pattern) => pattern.replace(SPECIAL, (char) => (char === "*" ? ".*" : `\\${char}`)))
    .join("|");
  const expression = new RegExp(`^(?:${alternatives})$`);

  return (specifier) => !OWN_FILE.test(specifier) && expression.test(specifier);
};

export function createResolver({ externals = [] }: ResolverOptions = {}): ResolveSpecifier {
  const supplied = suppliedBy(externals);
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
    if (supplied(specifier)) return { kind: "external", name: specifier };

    const key = `${dirname(fromFile)}\0${specifier}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const resolution = resolutionOf(factory.resolveFileSync(fromFile, specifier), specifier);
    cache.set(key, resolution);
    return resolution;
  };
}
