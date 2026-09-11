import { relative } from "node:path";
import picomatch from "picomatch";
import { toPosix } from "../paths/posix.ts";
import type { Project, ResolvedImport } from "../project/model.ts";
import type { Finding } from "../report/model.ts";
import type { Claim } from "./model.ts";

const GUIDANCE =
  "A rule matching one directory is a warning rather than an error, because a second sibling may simply not exist yet; if the pattern was meant to reach a level deeper, it is the pattern that is wrong and not the tree. Two directories that were meant to stand alone are reaching into each other. Siblings under the same parent are separate parts, and once one imports another neither can be read, moved or deleted without the other, so the parent stops being a set of parts and becomes one unit. Move what they share up to a directory both may reach, or out of the group entirely, and import it from there. Listing the sibling in `except` is not the fix: that is for a directory everyone is meant to share, not for the one case you would like to allow today. `except` matches a group name as a pattern, so name the convention rather than the instances and every directory following it later is covered too. It exempts a directory as a target only: one that reaches back into a sibling is not being shared by the group, it is depending on one of its members, and that is the thing this rule exists to name.";

const LOOSE =
  "A file sits directly in the directory whose children are being kept apart, so it belongs to no sibling and the isolation rule does not govern it: it may reach into every group and nothing will say so. Move it into the sibling that uses it, or out of the parent entirely if several do. A file whose job is the group itself — an index, a route manifest, the thing that assembles the siblings — is the exception, and `wiring` is where you say so. It matches the path as a pattern, so name the convention rather than the instances and the files added later are covered too. Listing a file there because you have not decided where it belongs is the fix that stops the rule working: `wiring` is for a file that assembles the group, not for the one you would like to allow today. Only the parent of a group is read this way, so a file anywhere else is not reported — it was never being kept apart. A directory that holds no group of its own is not a parent, however well its own path matches the pattern: with no siblings under it there is nothing for its files to sit beside, and nowhere they could be asked to move.";

export interface IsolationRule {
  readonly siblings: string;
  readonly except?: readonly string[] | undefined;
  readonly wiring?: readonly string[] | undefined;
}

type GroupOf = (file: string) => string | null;

const groupReader = (root: string, pattern: string): GroupOf => {
  const expression = picomatch.makeRe(`${pattern}/**`, { dot: true, capture: true });

  return (file) => {
    const captured = expression.exec(toPosix(relative(root, file)));
    if (captured === null) return null;

    const segments = captured.slice(1, -1).filter((segment) => segment !== undefined);
    return segments.length === 0 ? null : segments.join("/");
  };
};

type SharedGroup = (group: string) => boolean;

const sharedBy = (patterns: readonly string[] | undefined): SharedGroup =>
  patterns === undefined ? () => false : picomatch([...patterns], { dot: true });

interface Grouping {
  readonly groupOf: GroupOf;
  readonly shared: SharedGroup;
  readonly project: Project;
}

const breachOf = (edge: ResolvedImport, { groupOf, shared, project }: Grouping): Finding | null => {
  if (edge.declaredIn === null) return null;

  const from = groupOf(edge.from);
  const to = groupOf(edge.declaredIn);
  if (from === null || to === null || from === to) return null;
  if (shared(to)) return null;

  const what = `${edge.imported} from ${project.relative(edge.declaredIn)}`;
  return {
    severity: "error",
    message: shared(from)
      ? `is ${from}, which the group shares, and may not reach into sibling ${to}: ${what}`
      : `is ${from} and may not reach sibling ${to}: ${what}`,
    file: edge.from,
    start: edge.at,
    symbols: [edge.imported],
  };
};

interface Groups {
  readonly groupOf: GroupOf;
  readonly names: readonly string[];
}

const groupsFor = (rule: IsolationRule, root: string, project: Project): Groups => {
  const groupOf = groupReader(root, rule.siblings);
  const names = [...new Set(project.files.map(groupOf).filter((group) => group !== null))].sort();
  return { groupOf, names };
};

const looseFinder = (rule: IsolationRule, root: string, project: Project): ((path: string) => boolean) => {
  const atParent = picomatch(rule.siblings, { dot: true });
  const groupOf = groupReader(root, rule.siblings);
  const grouped = project.files
    .filter((file) => groupOf(file) !== null)
    .map((file) => toPosix(relative(root, file)));

  return (path) => {
    if (!atParent(path)) return false;
    const parent = path.slice(0, path.lastIndexOf("/") + 1);
    return grouped.some((file) => file.startsWith(parent));
  };
};

const findingsFor = (rule: IsolationRule, root: string, project: Project): readonly Finding[] => {
  const { groupOf, names: groups } = groupsFor(rule, root, project);

  if (groups.length === 0) {
    return [
      {
        severity: "error",
        message: `\`${rule.siblings}\` matches no directory, so nothing is being kept apart`,
        file: null,
        start: null,
      },
    ];
  }

  if (groups.length === 1) {
    return [
      {
        severity: "warning",
        message: `\`${rule.siblings}\` matches only ${groups.join("")}, so it is keeping nothing apart yet`,
        file: null,
        start: null,
      },
    ];
  }

  const grouping: Grouping = { groupOf, shared: sharedBy(rule.except), project };
  return project
    .imports()
    .map((edge) => breachOf(edge, grouping))
    .filter((finding) => finding !== null);
};

const looseIn = (rule: IsolationRule, root: string, project: Project): readonly Finding[] => {
  if (rule.wiring === undefined) return [];

  const assembles = picomatch([...rule.wiring], { dot: true });
  const loose = looseFinder(rule, root, project);

  return project.files
    .map((file) => ({ file, path: toPosix(relative(root, file)) }))
    .filter(({ path }) => loose(path) && !assembles(path))
    .map(({ file }) => ({
      severity: "error" as const,
      message: `sits beside the siblings \`${rule.siblings}\` rather than in one of them`,
      file,
      start: null,
    }));
};

export interface SiblingsInput {
  readonly rules: readonly IsolationRule[];
  readonly root: string;
  readonly project: Project;
  readonly path: string;
}

export interface SiblingPlacement {
  readonly siblings: string;
  readonly group: string | null;
  readonly apart: readonly string[];
  readonly shared: readonly string[];
  readonly assembles: boolean;
}

const insideGroup = (rule: IsolationRule, names: readonly string[], group: string): SiblingPlacement => {
  const shares = sharedBy(rule.except);
  const others = names.filter((name) => name !== group);

  return {
    siblings: rule.siblings,
    group,
    apart: others.filter((name) => !shares(name)),
    shared: others.filter((name) => shares(name)),
    assembles: false,
  };
};

const besideGroup = (rule: IsolationRule, names: readonly string[], here: string): SiblingPlacement | null =>
  rule.wiring === undefined
    ? null
    : {
        siblings: rule.siblings,
        group: null,
        apart: names,
        shared: [],
        assembles: picomatch([...rule.wiring], { dot: true })(here),
      };

export const siblingsFor = ({ rules, root, project, path }: SiblingsInput): readonly SiblingPlacement[] => {
  const here = toPosix(relative(root, path));

  return rules.flatMap((rule) => {
    const { groupOf, names } = groupsFor(rule, root, project);
    if (names.length < 2) return [];

    const group = groupOf(path);
    if (group !== null) return [insideGroup(rule, names, group)];

    const beside = looseFinder(rule, root, project)(here) ? besideGroup(rule, names, here) : null;
    return beside === null ? [] : [beside];
  });
};

export function loosePlacementClaim(rules: readonly IsolationRule[]): Claim {
  return {
    name: "no-file-sits-loose-beside-a-group",
    guidance: LOOSE,
    check: ({ root, project }) => rules.flatMap((rule) => looseIn(rule, root, project)),
  };
}

export function isolationClaim(rules: readonly IsolationRule[]): Claim {
  return {
    name: "no-sibling-directory-reaches-another",
    guidance: GUIDANCE,
    check: ({ root, project }) => rules.flatMap((rule) => findingsFor(rule, root, project)),
  };
}
