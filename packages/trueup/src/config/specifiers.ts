import { registerHooks } from "node:module";

type Resolve = (specifier: string, context: unknown) => unknown;

const AS_EMITTED: Readonly<Record<string, string>> = {
  ".js": ".ts",
  ".mjs": ".mts",
  ".cjs": ".cts",
};

const sourceFor = (specifier: string): string | null => {
  const emitted = Object.keys(AS_EMITTED).find((extension) => specifier.endsWith(extension));
  if (emitted === undefined) return null;

  return `${specifier.slice(0, -emitted.length)}${AS_EMITTED[emitted]}`;
};

const typed = (resolved: unknown): unknown => {
  if (process.features.typescript === false) return resolved;
  if (typeof resolved !== "object" || resolved === null) return resolved;

  const { url, format } = resolved as { url?: unknown; format?: unknown };
  if (format !== null && format !== undefined) return resolved;
  if (typeof url !== "string" || !url.endsWith(".ts")) return resolved;

  return { ...resolved, format: "module-typescript" };
};

const attempt = (specifier: string, context: unknown, next: Resolve): unknown => {
  try {
    return next(specifier, context);
  } catch {
    return null;
  }
};

let allowed = false;

export const allowEmittedSpecifiers = (): void => {
  if (allowed) return;
  allowed = true;

  registerHooks({
    resolve: (specifier, context, next) => {
      const direct = attempt(specifier, context, next as Resolve);
      if (direct !== null) return typed(direct) as ReturnType<typeof next>;

      const source = sourceFor(specifier);
      const found = source === null ? null : attempt(source, context, next as Resolve);
      if (found !== null) return typed(found) as ReturnType<typeof next>;

      return typed(next(specifier, context)) as ReturnType<typeof next>;
    },
  });
};
