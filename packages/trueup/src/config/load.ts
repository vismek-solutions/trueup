import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { toPosix } from "../paths/posix.ts";
import { withDerivedDoors } from "./exports.ts";
import { strayKeysIn, type ConfigKind } from "./keys.ts";
import {
  apiSurfaces,
  assertReachable,
  boundariesOf,
  configIn,
  directoryLimitsOf,
  expanded,
  grantsOf,
  isolateOf,
  memberDirectories,
  reachRules,
  rulesOf,
  seamsOf,
  zonesOf,
  type Member,
} from "./members.ts";
import type { ArchitectureConfig, MemberConfig, ResolvedConfig } from "./model.ts";
import { allowEmittedSpecifiers } from "./specifiers.ts";

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

export const messageOf = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);

const importedFrom = async (path: string): Promise<unknown> => {
  allowEmittedSpecifiers();
  try {
    return await import(pathToFileURL(path).href);
  } catch (failure) {
    throw new Error(`${path} could not be read: ${messageOf(failure)}`, { cause: failure });
  }
};

const exportedFrom = async (path: string, kind: ConfigKind): Promise<object> => {
  const imported = await importedFrom(path);
  const config = (imported as { default?: unknown }).default;

  if (config === null || typeof config !== "object") {
    throw new Error(`${path} has no default-exported configuration object`);
  }

  const stray = strayKeysIn(config, kind);
  if (stray !== null) throw new Error(`${path} ${stray}`);

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

  const config = await exportedFrom(configPath, "member");
  if (!declaresZones(config)) throw new Error(`${configPath} declares no zones`);

  return {
    name: relativePath.slice(relativePath.lastIndexOf("/") + 1),
    directory: relativePath,
    configPath,
    config: withDerivedDoors(config as MemberConfig, directory),
  };
};

const claimedOnce = (names: readonly string[]): void => {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) throw new Error(`${name} is claimed twice, by two zones, two members, or one of each`);
    seen.add(name);
  }
};

const withMembers = (
  config: ArchitectureConfig,
  members: readonly Member[],
  root: string,
): ResolvedConfig => {
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
    seams: [...seamsOf(members), ...(config.seams ?? [])],
    isolate: [...isolateOf(members), ...(config.isolate ?? [])],
    rules: [...rulesOf(members, root), ...(config.rules ?? [])],
    directoryLimits: directoryLimitsOf(members, root),
    apiSurfaces: apiSurfaces(members, root),
    grants: grantsOf(members, root),
  };
};

const membersUnder = async (root: string, patterns: readonly string[]): Promise<Member[]> => {
  const settled = await Promise.allSettled(
    memberDirectories(root, patterns).map((directory) => memberAt(root, directory)),
  );

  const refused = settled
    .filter((outcome) => outcome.status === "rejected")
    .map((outcome) => messageOf(outcome.reason));
  if (refused.length > 0) throw new Error(refused.join("\n"));

  return settled.filter((outcome) => outcome.status === "fulfilled").map((outcome) => outcome.value);
};

export async function loadConfig(path: string): Promise<LoadedConfig> {
  const exported = await exportedFrom(path, "root");
  const config = exported as ArchitectureConfig;
  const root = dirname(path);

  const patterns = config.members ?? [];
  if (patterns.length === 0 && !declaresZones(exported)) throw new Error(`${path} declares no zones`);

  const members = await membersUnder(root, patterns);

  return {
    config: withMembers(config, members, root),
    path,
    root,
    memberConfigs: members.map((member) => member.configPath),
  };
}

export const resolveInclude = (root: string, include: readonly string[] | undefined): readonly string[] =>
  include === undefined || include.length === 0
    ? [root]
    : include.map((entry) => (isAbsolute(entry) ? entry : join(root, entry)));
