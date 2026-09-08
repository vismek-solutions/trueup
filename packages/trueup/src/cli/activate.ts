import { relative } from "node:path";
import { reachOf } from "../compose.ts";
import type { ResolvedConfig } from "../config/model.ts";
import { pathsIn, rulebookGuarded } from "../guard/protected.ts";
import { toPosix } from "../paths/posix.ts";
import { DEFAULT_COMMAND } from "../report/invocation.ts";
import { adviceLines } from "./agent-instructions.ts";
import { EXIT_BAD_USAGE, EXIT_CLEAN, type CommandInput } from "./command.ts";
import { openedIn, refusedArguments } from "./preamble.ts";
import { plural } from "./render.ts";

const COLUMN = 26;
const TALLY = 9;

const section = (heading: string, rows: readonly string[]): readonly string[] =>
  rows.length === 0 ? [] : ["", heading, ...rows];

interface Zoned {
  readonly filesIn: (zone: string) => readonly string[];
}

const zoneLines = (config: ResolvedConfig, project: Zoned): readonly string[] => {
  const width = Math.max(...config.zones.map((zone) => zone.name.length));

  return config.zones.map((zone) => {
    const held = plural(project.filesIn(zone.name).length, "file").padStart(TALLY);
    const role = zone.role === undefined ? "" : `  (${zone.role})`;
    return `  ${zone.name.padEnd(width)}  ${held}  ${zone.patterns.join(" · ")}${role}`;
  });
};

const reachedBy = (named: readonly string[], zones: number): string => {
  if (named.length === 0) return "nothing";
  return named.length === zones - 1 ? "every other zone, since no rule constrains it" : named.join(" · ");
};

const boundaryLines = (config: ResolvedConfig): readonly string[] => {
  const boundaries = config.boundaries ?? [];
  if (boundaries.length === 0) return [];

  const width = Math.max(...config.zones.map((zone) => zone.name.length));
  return config.zones.map((zone) => {
    const { mayReach } = reachOf({ zone: zone.name, zones: config.zones, boundaries });
    const named = mayReach.filter((name) => name !== zone.name);
    return `  ${zone.name.padEnd(width)} → ${reachedBy(named, config.zones.length)}`;
  });
};

const seamLines = (config: ResolvedConfig): readonly string[] =>
  (config.seams ?? []).map((rule) => {
    const spared = rule.allow === undefined ? "" : `, except ${rule.allow.join(" · ")}`;
    const shortest =
      rule.minLiteralLength === undefined ? "" : `, literals from ${rule.minLiteralLength} characters`;
    return `  ${rule.generic} may not name what ${rule.domain.join(" · ")} owns${spared}${shortest}`;
  });

const isolateLines = (config: ResolvedConfig): readonly string[] =>
  (config.isolate ?? []).map((rule) => {
    const spared = rule.except === undefined ? "" : `, except ${rule.except.join(" · ")}`;
    return `  ${rule.siblings}${spared}`;
  });

const limitLines = (config: ResolvedConfig, root: string): readonly string[] =>
  (config.directoryLimits ?? []).map(
    (limit) => `  ${toPosix(relative(root, limit.within))} holds at most ${limit.max} files`,
  );

const counted = (value: number | undefined): string | undefined =>
  value === undefined ? undefined : String(value);

const switched = (value: boolean | undefined): string | undefined => {
  if (value === undefined) return undefined;
  return value ? "on" : "off";
};

const settingLines = (config: ResolvedConfig, read: number): readonly string[] => {
  const values: readonly (readonly [string, string | undefined])[] = [
    ["files read", String(read)],
    ["members", config.members?.join(" · ")],
    ["roots", config.include?.join(" · ")],
    ["extensions", config.extensions?.join(" · ")],
    ["externals", config.externals?.join(" · ")],
    ["ignored directories", config.ignoreDirectories?.join(" · ")],
    ["max files per directory", counted(config.maxFilesPerDirectory)],
    [
      "duplication",
      config.duplication === undefined
        ? undefined
        : `declarations from ${config.duplication} characters`,
    ],
    ["colocation", switched(config.colocation)],
    ["test internals", switched(config.testInternals)],
    [
      "rulebook",
      rulebookGuarded(config.protect)
        ? "guarded, so an edit to it is ruled on"
        : "unguarded, so an agent may edit it and switch off any check it fails",
    ],
    ["also protected", pathsIn(config.protect).join(" · ")],
    ["also runs", config.runners?.map((runner) => runner.name).join(" · ")],
    ["custom rules", config.rules?.map((rule) => rule.name).join(" · ")],
  ];

  return values.flatMap(([label, value]) =>
    value === undefined || value === "" ? [] : [`  ${label.padEnd(COLUMN)}${value}`],
  );
};

export async function runActivate({ cwd, argv, write }: CommandInput): Promise<number> {
  if (refusedArguments(argv, "activate", write)) return EXIT_BAD_USAGE;

  const opened = await openedIn(cwd, write);
  if (typeof opened === "number") return opened;

  const { config, root, project } = opened;
  const homeless = project.files.filter((file) => project.zoneOf(file) === null);

  for (const line of [
    "## Architecture",
    "",
    `${plural(project.files.length, "file")} in ${plural(config.zones.length, "zone")}, and every rule below is enforced.`,
    ...section(
      "zones — a file belongs to the first zone whose patterns match it; a role changes what is expected of it",
      [
        ...zoneLines(config, project),
        ...(homeless.length === 0 ? [] : [`  and ${plural(homeless.length, "file")} in no zone at all`]),
      ],
    ),
    ...section(
      "boundaries — a zone may reach itself and what is listed here, and nothing else",
      boundaryLines(config),
    ),
    ...section("seams — generic code may not use the vocabulary its domains own", seamLines(config)),
    ...section(
      "isolate — directories matched by one pattern are siblings, and a sibling may not reach another",
      isolateLines(config),
    ),
    ...section("directory limits", limitLines(config, root)),
    ...section("settings", settingLines(config, project.files.length)),
    "",
    ...adviceLines(config.command ?? DEFAULT_COMMAND),
  ]) {
    write(line);
  }

  return EXIT_CLEAN;
}
