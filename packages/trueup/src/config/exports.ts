import { relative, resolve } from "node:path";
import { toPosix } from "../paths/posix.ts";
import type { ZoneDefinition } from "../zones/model.ts";
import { manifestIn } from "./manifest.ts";
import type { MemberConfig } from "./model.ts";

export interface ExportedFile {
  readonly subpath: string;
  readonly file: string;
}

const DERIVED_DOOR = "api";

const targetOf = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object") return null;

  const conditions = value as Record<string, unknown>;
  const picked = conditions.import ?? conditions.default;
  return typeof picked === "string" ? picked : null;
};

const subpathsIn = (field: unknown): readonly (readonly [string, string])[] => {
  if (typeof field === "string") return [[".", field]];
  if (field === null || typeof field !== "object") return [];

  const record = field as Record<string, unknown>;
  const keys = Object.keys(record);

  if (!keys.some((key) => key.startsWith("."))) {
    const target = targetOf(record);
    return target === null ? [] : [[".", target]];
  }

  return keys.flatMap((key) => {
    const target = key.startsWith(".") ? targetOf(record[key]) : null;
    return target === null ? [] : [[key, target] as const];
  });
};

export interface PublicSurface {
  readonly files: readonly ExportedFile[];
  readonly complete: boolean;
}

export const exportedFilesIn = (directory: string): PublicSurface | null => {
  const manifest = manifestIn(directory);
  if (manifest === null) return null;

  const subpaths = subpathsIn(manifest.exports);
  const named = subpaths.filter(([subpath, target]) => !subpath.includes("*") && !target.includes("*"));
  if (named.length === 0) return null;

  return {
    files: named.map(([subpath, target]) => ({ subpath, file: resolve(directory, target) })),
    complete: named.length === subpaths.length,
  };
};

export const withDerivedDoors = (config: MemberConfig, directory: string): MemberConfig => {
  if (config.doorsFromExports !== true) return config;

  if (config.zones.some((zone) => zone.role === "api")) {
    throw new Error(`${directory} sets \`doorsFromExports\` and also declares an api zone`);
  }

  const exported = exportedFilesIn(directory);
  if (exported === null) {
    throw new Error(`${directory} sets \`doorsFromExports\` but its package.json exports nothing readable`);
  }

  const door: ZoneDefinition = {
    name: DERIVED_DOOR,
    patterns: exported.files.map((entry) => toPosix(relative(directory, entry.file))),
    role: "api",
  };

  return { ...config, zones: [door, ...config.zones] };
};
