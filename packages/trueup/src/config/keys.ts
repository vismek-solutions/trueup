import type { ArchitectureConfig, MemberConfig } from "./model.ts";

const ROOT: Record<keyof ArchitectureConfig, true> = {
  assets: true,
  boundaries: true,
  changes: true,
  colocation: true,
  command: true,
  duplication: true,
  extensions: true,
  externals: true,
  ignoreDirectories: true,
  include: true,
  isolate: true,
  maxFilesPerDirectory: true,
  members: true,
  protect: true,
  readerships: true,
  reviewable: true,
  rules: true,
  runners: true,
  seams: true,
  testInternals: true,
  text: true,
  zones: true,
};

const MEMBER: Record<keyof MemberConfig, true> = {
  allow: true,
  boundaries: true,
  doorsFromExports: true,
  isolate: true,
  maxFilesPerDirectory: true,
  rules: true,
  seams: true,
  zones: true,
};

export type ConfigKind = "root" | "member";

const named = (values: readonly string[]): string => `\`${values.join("`, `")}\``;

const accepted = (kind: ConfigKind): Record<string, true> => (kind === "root" ? ROOT : MEMBER);

const other = (kind: ConfigKind): ConfigKind => (kind === "root" ? "member" : "root");

const elsewhere = (keys: readonly string[], kind: ConfigKind): string =>
  keys.length === 0 ? "" : ` ${named(keys)} belongs in the ${other(kind)} configuration.`;

export const strayKeysIn = (config: object, kind: ConfigKind): string | null => {
  const stray = Object.keys(config).filter((key) => accepted(kind)[key] !== true);
  if (stray.length === 0) return null;

  const known = stray.filter((key) => accepted(other(kind))[key] === true);

  return [
    `sets ${named(stray)}, which a ${kind} configuration does not read.`,
    elsewhere(known, kind),
    ` A ${kind} configuration accepts ${named(Object.keys(accepted(kind)))}.`,
    " A key it does not read is ignored, so the run makes one fewer claim than you configured and nothing says so.",
  ].join("");
};
