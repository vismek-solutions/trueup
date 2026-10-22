import { relative } from "node:path";
import { gitChanges } from "../../adapters/git/changes.ts";
import { changeSizeIn } from "../../main.ts";
import type { ResolvedConfig } from "../../config/model.ts";
import { toPosix } from "../../paths/posix.ts";
import { DEFAULT_COMMAND } from "../../report/invocation.ts";
import { adviceLines } from "../agent-instructions.ts";
import { EXIT_BAD_USAGE, EXIT_CLEAN, type CommandInput } from "../command.ts";
import { openedIn, refusedArguments } from "../preamble.ts";
import { plural } from "../render.ts";
import { spoken, tagged } from "../tags.ts";
import { settingLines } from "./settings.ts";
import { reachLines, zoneLines } from "./zones.ts";

const section = (name: string, rows: readonly string[], said?: string): readonly string[] =>
  rows.length === 0 ? [] : ["", ...tagged(name, said === undefined ? rows : [said, ...rows])];

const BOUNDARIES = "a zone may reach itself and what is listed here, and nothing else";
const UNDER_IT = "; a name ending in /* is every zone under it";

const boundarySection = (config: ResolvedConfig): readonly string[] => {
  const lines = reachLines(config);
  return section("boundaries", lines, lines.some((line) => line.includes("/*")) ? BOUNDARIES + UNDER_IT : BOUNDARIES);
};

const seamLines = (config: ResolvedConfig): readonly string[] =>
  config.seams.map((rule) => {
    const spared = rule.allow === undefined ? "" : `, except ${spoken(rule.allow)}`;
    const shortest = rule.minLiteralLength === undefined ? "" : `, literals from ${rule.minLiteralLength} characters`;
    return `* ${rule.generic} may not name what ${spoken(rule.domain)} owns${spared}${shortest}`;
  });

type Exception = NonNullable<ResolvedConfig["isolate"][number]["except"]>[number];

const orderedLines = (except: readonly Exception[]): readonly string[] =>
  except.flatMap((entry) => {
    if (typeof entry === "string") return [];
    const reach = entry.allow === undefined || entry.allow.length === 0 ? "nothing" : spoken(entry.allow);
    return [`   * ${entry.shared} may reach ${reach}`];
  });

const isolateLines = (config: ResolvedConfig): readonly string[] =>
  config.isolate.flatMap((rule) => {
    const names = (rule.except ?? []).map((one) => (typeof one === "string" ? one : one.shared));
    const spared = rule.except === undefined ? "" : `, except ${spoken(names)}`;
    const beside = rule.wiring === undefined ? "" : `, and only ${spoken(rule.wiring)} may sit beside them`;
    const loose = rule.wiring?.length === 0 ? ", and nothing may sit beside them" : beside;
    return [`* ${rule.siblings}${spared}${loose}`, ...orderedLines(rule.except ?? [])];
  });

const limitLines = (config: ResolvedConfig, root: string): readonly string[] =>
  config.directoryLimits.map((limit) => `* ${toPosix(relative(root, limit.within))} holds at most ${limit.max} files`);

const standingIn = (config: ResolvedConfig, root: string): readonly string[] => {
  const budget = config.reviewable;
  if (budget === undefined) return [];

  const changed = (config.changes ?? gitChanges()).since(root, budget.base ?? "main");
  if (changed.kind === "unmeasured") return ["", ...tagged("this-branch", `not measured, so nothing holds it: ${changed.reason}`)];

  const { added, removed } = changeSizeIn(changed.files, budget);
  const left = Math.max(0, budget.additions - added);
  return ["", ...tagged("this-branch", `+${added} / -${removed} so far, ${plural(left, "addition")} left`)];
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
    ...tagged(
      "summary",
      `${plural(project.files.length, "file")} in ${plural(config.zones.length, "zone")}, and every rule below is enforced.`,
    ),
    ...section(
      "zones",
      [
        ...zoneLines(config, project),
        ...(homeless.length === 0 ? [] : [`and ${plural(homeless.length, "file")} in no zone at all`]),
      ],
      "a file belongs to the first zone whose patterns match it; a role or a shared mark changes what is expected of it",
    ),
    ...boundarySection(config),
    ...section("seams", seamLines(config), "generic code may not use the vocabulary its domains own"),
    ...section(
      "isolate",
      isolateLines(config),
      "directories matched by one pattern are siblings, and a sibling may not reach another",
    ),
    ...section("directory-limits", limitLines(config, root)),
    ...section("settings", settingLines(config, project.files.length)),
    ...standingIn(config, root),
    "",
    ...tagged("advice", adviceLines(config.command ?? DEFAULT_COMMAND)),
  ]) {
    write(line);
  }

  return EXIT_CLEAN;
}
