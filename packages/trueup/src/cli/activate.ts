import { relative } from "node:path";
import { gitChanges } from "../adapters/git/changes.ts";
import { changeSizeIn, reachOf } from "../compose.ts";
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

const FEW = 4;

const listed = (names: readonly string[]): string => (names.length === 0 ? "nothing" : names.join(" · "));

const groupOf = (zone: string): string | null => {
  const cut = zone.indexOf("/");
  return cut === -1 ? null : zone.slice(0, cut);
};

const wholeGroups = (named: readonly string[], others: readonly string[]): ReadonlySet<string> => {
  const held = new Map<string, number>();
  const taken = new Map<string, number>();

  for (const zone of others) {
    const group = groupOf(zone);
    if (group === null) continue;
    held.set(group, (held.get(group) ?? 0) + 1);
    if (named.includes(zone)) taken.set(group, (taken.get(group) ?? 0) + 1);
  }

  return new Set([...held].filter(([group, count]) => count > 1 && taken.get(group) === count).map(pairName));
};

const pairName = ([name]: readonly [string, number]): string => name;

const byGroup = (named: readonly string[], whole: ReadonlySet<string>): readonly string[] => {
  const said = new Set<string>();

  return named.flatMap((zone) => {
    const group = groupOf(zone);
    if (group === null || !whole.has(group)) return [zone];
    if (said.has(group)) return [];
    said.add(group);
    return [`${group}/*`];
  });
};

const everything = (ruled: boolean): string =>
  ruled ? "every other zone" : "every other zone, since no rule constrains it";

const reachedBy = (named: readonly string[], others: readonly string[], ruled: boolean): string => {
  if (named.length === 0) return "nothing";
  if (named.length === others.length) return everything(ruled);

  const grouped = byGroup(named, wholeGroups(named, others));
  const closed = others.filter((name) => !named.includes(name));
  return grouped.length > FEW && closed.length < grouped.length
    ? `every other zone except ${listed(closed)}`
    : listed(grouped);
};

const BOUNDARIES = "boundaries — a zone may reach itself and what is listed here, and nothing else";
const UNDER_IT = "; a name ending in /* is every zone under it";

const boundaryLines = (config: ResolvedConfig): readonly string[] => {
  const boundaries = config.boundaries;
  if (boundaries.length === 0) return [];

  const names = config.zones.map((zone) => zone.name);
  const width = Math.max(...names.map((name) => name.length));
  const ruled = new Set(boundaries.map((rule) => rule.from));

  return config.zones.map((zone) => {
    const { mayReach } = reachOf({ zone: zone.name, zones: config.zones, boundaries });
    const named = mayReach.filter((name) => name !== zone.name);
    const others = names.filter((name) => name !== zone.name);
    return `  ${zone.name.padEnd(width)} → ${reachedBy(named, others, ruled.has(zone.name))}`;
  });
};

const boundarySection = (config: ResolvedConfig): readonly string[] => {
  const lines = boundaryLines(config);
  return section(lines.some((line) => line.includes("/*")) ? BOUNDARIES + UNDER_IT : BOUNDARIES, lines);
};

const seamLines = (config: ResolvedConfig): readonly string[] =>
  config.seams.map((rule) => {
    const spared = rule.allow === undefined ? "" : `, except ${rule.allow.join(" · ")}`;
    const shortest =
      rule.minLiteralLength === undefined ? "" : `, literals from ${rule.minLiteralLength} characters`;
    return `  ${rule.generic} may not name what ${rule.domain.join(" · ")} owns${spared}${shortest}`;
  });

type Exception = NonNullable<ResolvedConfig["isolate"][number]["except"]>[number];

const orderedLines = (except: readonly Exception[]): readonly string[] => {
  const ordered = except.filter((exception) => typeof exception !== "string");
  const width = Math.max(0, ...ordered.map((entry) => entry.shared.length));
  return ordered.map((entry) => `    ${entry.shared.padEnd(width)} → ${listed(entry.allow)}`);
};

const isolateLines = (config: ResolvedConfig): readonly string[] =>
  config.isolate.flatMap((rule) => {
    const names = (rule.except ?? []).map((one) => (typeof one === "string" ? one : one.shared));
    const spared = rule.except === undefined ? "" : `, except ${names.join(" · ")}`;
    const beside =
      rule.wiring === undefined ? "" : `, and only ${rule.wiring.join(" · ")} may sit beside them`;
    const loose = rule.wiring?.length === 0 ? ", and nothing may sit beside them" : beside;
    return [`  ${rule.siblings}${spared}${loose}`, ...orderedLines(rule.except ?? [])];
  });

const limitLines = (config: ResolvedConfig, root: string): readonly string[] =>
  config.directoryLimits.map(
    (limit) => `  ${toPosix(relative(root, limit.within))} holds at most ${limit.max} files`,
  );

const counted = (value: number | undefined): string | undefined =>
  value === undefined ? undefined : String(value);

type Budget = NonNullable<ResolvedConfig["reviewable"]>;

const capOf = (budget: Budget): string => `+${budget.additions} / -${budget.deletions}`;

const budgetSaid = (budget: Budget | undefined): string | undefined => {
  if (budget === undefined) return undefined;
  const band = budget.nearing === undefined ? "" : `, warning from ${budget.nearing * 100}%`;
  const bite = budget.severity === "error" ? "fails" : "warns";

  return `${capOf(budget)} against ${budget.base ?? "main"}, ${bite} past it${band}`;
};

const standingIn = (config: ResolvedConfig, root: string): readonly string[] => {
  const budget = config.reviewable;
  if (budget === undefined) return [];

  const changed = (config.changes ?? gitChanges()).since(root, budget.base ?? "main");
  if (changed.kind === "unmeasured") return [`  not measured, so nothing holds it: ${changed.reason}`];

  const { added, removed } = changeSizeIn(changed.files, budget);
  const left = Math.max(0, budget.additions - added);
  return [`  +${added} / -${removed} so far, ${plural(left, "addition")} left`];
};

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
      config.duplication === undefined ? undefined : `declarations from ${config.duplication} characters`,
    ],
    ["reviewable", budgetSaid(config.reviewable)],
    ["colocation", switched(config.colocation)],
    ["readerships", switched(config.readerships)],
    ["test internals", switched(config.testInternals)],
    [
      "rulebook",
      rulebookGuarded(config.protect)
        ? "guarded, so an edit to it is ruled on"
        : "unguarded, so an agent may edit it and switch off any check it fails",
    ],
    ["also protected", pathsIn(config.protect).join(" · ")],
    ["also runs", config.runners?.map((runner) => runner.name).join(" · ")],
    ["custom rules", config.rules.map((rule) => rule.name).join(" · ")],
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
    ...boundarySection(config),
    ...section("seams — generic code may not use the vocabulary its domains own", seamLines(config)),
    ...section(
      "isolate — directories matched by one pattern are siblings, and a sibling may not reach another",
      isolateLines(config),
    ),
    ...section("directory limits", limitLines(config, root)),
    ...section("settings", settingLines(config, project.files.length)),
    ...section("this branch", standingIn(config, root)),
    "",
    ...adviceLines(config.command ?? DEFAULT_COMMAND),
  ]) {
    write(line);
  }

  return EXIT_CLEAN;
}
