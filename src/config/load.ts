import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ArchitectureConfig } from "./model.ts";

const CONFIG_NAMES = ["architecture.config.ts", "architecture.config.js", "architecture.config.mjs"];

export interface LoadedConfig {
  readonly config: ArchitectureConfig;
  readonly path: string;
  readonly root: string;
}

export function findConfig(from: string): string | null {
  let directory = resolve(from);
  for (;;) {
    for (const name of CONFIG_NAMES) {
      const candidate = join(directory, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(directory);
    if (parent === directory || directory === parse(directory).root) return null;
    directory = parent;
  }
}

export async function loadConfig(path: string): Promise<LoadedConfig> {
  const imported: unknown = await import(pathToFileURL(path).href);
  const config = (imported as { default?: unknown }).default;

  if (config === undefined || config === null || typeof config !== "object") {
    throw new Error(`${path} has no default-exported configuration object`);
  }
  const zones = (config as ArchitectureConfig).zones;
  if (!Array.isArray(zones) || zones.length === 0) {
    throw new Error(`${path} declares no zones`);
  }

  return { config: config as ArchitectureConfig, path, root: dirname(path) };
}

export const resolveInclude = (root: string, include: readonly string[] | undefined): readonly string[] =>
  include === undefined || include.length === 0
    ? [root]
    : include.map((entry) => (isAbsolute(entry) ? entry : join(root, entry)));
