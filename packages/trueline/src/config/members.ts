import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import picomatch from "picomatch";
import type { ApiSurface } from "../claims/api-surface.ts";
import type { BoundaryRule } from "../claims/boundary.ts";
import type { Rule } from "../claims/custom.ts";
import type { DirectoryLimit } from "../claims/placement/directories.ts";
import type { SeamRule } from "../claims/seam.ts";
import { toPosix } from "../paths/posix.ts";
import { exportedFilesIn } from "./exports.ts";
import type { Project } from "../project/model.ts";
import type { ZoneDefinition } from "../zones/model.ts";
import type { MemberConfig } from "./model.ts";
import { scopedTo } from "./scoped.ts";

const CONFIG_NAMES = ["trueline.config.ts", "trueline.config.js", "trueline.config.mjs"];

const SKIPPED = new Set([".git", "node_modules", "dist", "build", "out", "coverage"]);

export const configIn = (directory: string): string | null => {
  for (const name of CONFIG_NAMES) {
    const candidate = join(directory, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
};

export interface Member {
  readonly name: string;
  readonly directory: string;
  readonly configPath: string;
  readonly config: MemberConfig;
}

const depthOf = (patterns: readonly string[]): number =>
  Math.max(...patterns.map((pattern) => pattern.split("/").length));

const directoriesUnder = (root: string, depth: number): string[] => {
  const found: string[] = [];

  const walk = (directory: string, left: number): void => {
    if (left === 0) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || SKIPPED.has(entry.name)) continue;
      const path = join(directory, entry.name);
      found.push(path);
      walk(path, left - 1);
    }
  };

  walk(root, depth);
  return found;
};

export const memberDirectories = (root: string, patterns: readonly string[]): readonly string[] => {
  const matches = picomatch([...patterns]);
  return directoriesUnder(root, depthOf(patterns))
    .filter((directory) => matches(toPosix(relative(root, directory))))
    .sort();
};

const qualified = (member: Member, zone: string): string => `${member.name}/${zone}`;

export const zonesOf = (member: Member): readonly ZoneDefinition[] =>
  member.config.zones.map((zone) => ({
    ...zone,
    name: qualified(member, zone.name),
    patterns: zone.patterns.map((pattern) => `${member.directory}/${pattern}`),
  }));

export const boundariesOf = (members: readonly Member[]): readonly BoundaryRule[] =>
  members.flatMap((member) =>
    (member.config.boundaries ?? []).map((rule) => ({
      ...rule,
      from: qualified(member, rule.from),
      allow: rule.allow.map((zone) => qualified(member, zone)),
      governs: namesOf(member),
    })),
  );

export const apiSurfaces = (members: readonly Member[], root: string): readonly ApiSurface[] =>
  members.flatMap((member) => {
    if (member.config.doorsFromExports === true) return [];

    const directory = join(root, member.directory);
    const exported = exportedFilesIn(directory);
    if (exported === null) return [];

    const doors = member.config.zones
      .filter((zone) => zone.role === "api")
      .map((zone) => qualified(member, zone.name));
    if (doors.length === 0) return [];

    return [
      {
        manifest: join(directory, "package.json"),
        doors,
        exported: exported.files,
        complete: exported.complete,
      },
    ];
  });

export const seamsOf = (members: readonly Member[]): readonly SeamRule[] =>
  members.flatMap((member) =>
    (member.config.seams ?? []).map((rule) => ({
      ...rule,
      generic: qualified(member, rule.generic),
      domain: rule.domain.map((zone) => qualified(member, zone)),
    })),
  );

export const rulesOf = (members: readonly Member[], root: string): readonly Rule[] =>
  members.flatMap((member) => {
    const scope = { directory: join(root, member.directory), prefix: `${member.name}/` };

    return (member.config.rules ?? []).map((rule) => ({
      ...rule,
      name: qualified(member, rule.name),
      check: (project: Project) => rule.check(scopedTo(project, scope)),
    }));
  });

export const directoryLimitsOf = (members: readonly Member[], root: string): readonly DirectoryLimit[] =>
  members.flatMap((member) =>
    member.config.maxFilesPerDirectory === undefined
      ? []
      : [{ within: join(root, member.directory), max: member.config.maxFilesPerDirectory }],
  );

export const assertReachable = (members: readonly Member[]): void => {
  const declared = new Set(members.map((member) => member.name));

  for (const member of members) {
    for (const target of member.config.allow ?? []) {
      if (target === member.name) throw new Error(`${member.directory} lists itself in \`allow\``);
      if (!declared.has(target)) {
        throw new Error(`${member.directory} may reach ${target}, which is not a member`);
      }
    }
  }
};

const namesOf = (member: Member): readonly string[] =>
  member.config.zones.map((zone) => qualified(member, zone.name));

const doorsOf = (member: Member): readonly string[] => {
  const doors = member.config.zones.filter((zone) => zone.role === "api");
  return doors.length === 0 ? namesOf(member) : doors.map((zone) => qualified(member, zone.name));
};

const openIn = (member: Member, invited: boolean): readonly string[] => (invited ? doorsOf(member) : []);

const grantedTo = (member: Member, members: readonly Member[]): readonly string[] => {
  const invited = new Set(member.config.allow ?? []);
  return members
    .filter((other) => other.name !== member.name)
    .flatMap((other) => openIn(other, invited.has(other.name)));
};

export const reachRules = (members: readonly Member[]): readonly BoundaryRule[] =>
  members.flatMap((member) => {
    const allow = [...namesOf(member), ...grantedTo(member, members)];

    return zonesOf(member).map((zone) => ({
      from: zone.name,
      allow,
      anchor: "imported-module" as const,
    }));
  });

export const expanded = (
  rules: readonly BoundaryRule[],
  members: readonly Member[],
): readonly BoundaryRule[] => {
  const byName = new Map(members.map((member) => [member.name, member]));
  const namesIn = (zone: string, entering: boolean): readonly string[] => {
    const member = byName.get(zone);
    if (member === undefined) return [zone];
    return entering ? doorsOf(member) : namesOf(member);
  };

  return rules.flatMap((rule) => {
    const origin = byName.get(rule.from);
    const own = origin === undefined ? [] : namesOf(origin);
    const crossing = [rule.from, ...rule.allow].some((zone) => byName.has(zone));

    if (crossing && rule.anchor === "declaring-file") {
      throw new Error(
        `boundary rule from ${rule.from} names a member and asks for declaring-file anchoring, which no api zone can ever satisfy`,
      );
    }

    return namesIn(rule.from, false).map((from) => ({
      ...rule,
      from,
      allow: [...own, ...rule.allow.flatMap((zone) => namesIn(zone, true))],
      ...(crossing ? { anchor: "imported-module" as const } : {}),
    }));
  });
};
