import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { toPosix } from "../paths/posix.ts";
import {
  assertReachable,
  boundariesOf,
  configIn,
  expanded,
  memberDirectories,
  reachRules,
  zonesOf,
  type Member,
} from "./members.ts";
import type { ArchitectureConfig, MemberConfig, ResolvedConfig } from "./model.ts";

export interface LoadedConfig {
  readonly config: ResolvedConfig;
  readonly path: string;
  readonly root: string;
  readonly memberConfigs: readonly string[];
}

export function findConfig(from: string): string | null {
  let directory = resolve(from);
  for (;;) {
    const candidate = configIn(directory);
    if (candidate !== null) return candidate;

    const parent = dirname(directory);
    if (parent === directory || directory === parse(directory).root) return null;
    directory = parent;
  }
}

const exportedFrom = async (path: string): Promise<object> => {
  const imported: unknown = await import(pathToFileURL(path).href);
  const config = (imported as { default?: unknown }).default;

  if (config === undefined || config === null || typeof config !== "object") {
    throw new Error(`${path} has no default-exported configuration object`);
  }
  return config;
};

const declaresZones = (config: object): boolean => {
  const { zones } = config as MemberConfig;
  return Array.isArray(zones) && zones.length > 0;
};

const memberAt = async (root: string, directory: string): Promise<Member> => {
  const relativePath = toPosix(relative(root, directory));
  const configPath = configIn(directory);
  if (configPath === null) {
    throw new Error(`${relativePath} matches a \`members\` pattern but holds no configuration file`);
  }

  const config = await exportedFrom(configPath);
  if (!declaresZones(config)) throw new Error(`${configPath} declares no zones`);

  return {
    name: relativePath.slice(relativePath.lastIndexOf("/") + 1),
    directory: relativePath,
    configPath,
    config: config as MemberConfig,
  };
};

const claimedOnce = (names: readonly string[]): void => {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) throw new Error(`${name} names both a member and a zone, or two members`);
    seen.add(name);
  }
};

const withMembers = (config: ArchitectureConfig, members: readonly Member[]): ResolvedConfig => {
  const own = config.zones ?? [];
  claimedOnce([...members.map((member) => member.name), ...own.map((zone) => zone.name)]);
  assertReachable(members);

  return {
    ...config,
    zones: [...members.flatMap(zonesOf), ...own],
    boundaries: [
      ...boundariesOf(members),
      ...reachRules(members),
      ...expanded(config.boundaries ?? [], members),
    ],
  };
};

export async function loadConfig(path: string): Promise<LoadedConfig> {
  const exported = await exportedFrom(path);
  const config = exported as ArchitectureConfig;
  const root = dirname(path);

  const patterns = config.members ?? [];
  if (patterns.length === 0 && !declaresZones(exported)) throw new Error(`${path} declares no zones`);

  const members = await Promise.all(
    memberDirectories(root, patterns).map((directory) => memberAt(root, directory)),
  );

  return {
    config: members.length === 0 ? { ...config, zones: config.zones ?? [] } : withMembers(config, members),
    path,
    root,
    memberConfigs: members.map((member) => member.configPath),
  };
}

export const resolveInclude = (root: string, include: readonly string[] | undefined): readonly string[] =>
  include === undefined || include.length === 0
    ? [root]
    : include.map((entry) => (isAbsolute(entry) ? entry : join(root, entry)));
