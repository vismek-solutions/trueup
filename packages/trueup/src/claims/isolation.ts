import { relative } from "node:path";
import picomatch from "picomatch";
import { toPosix } from "../paths/posix.ts";
import type { Project, ResolvedImport } from "../project/model.ts";
import type { Finding } from "../report/model.ts";
import type { Claim } from "./model.ts";

const GUIDANCE =
  "A rule matching one directory is a warning rather than an error, because a second sibling may simply not exist yet; if the pattern was meant to reach a level deeper, it is the pattern that is wrong and not the tree. Two directories that were meant to stand alone are reaching into each other. Siblings under the same parent are separate parts, and once one imports another neither can be read, moved or deleted without the other, so the parent stops being a set of parts and becomes one unit. Move what they share up to a directory both may reach, or out of the group entirely, and import it from there. Listing the sibling in `except` is not the fix: that is for a directory everyone is meant to share, not for the one case you would like to allow today. `except` matches a group name as a pattern, so name the convention rather than the instances and every directory following it later is covered too. It exempts a directory as a target only: one that reaches back into a sibling is not being shared by the group, it is depending on one of its members, and that is the thing this rule exists to name.";

export interface IsolationRule {
  readonly siblings: string;
  readonly except?: readonly string[] | undefined;
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
  };
};

const findingsFor = (rule: IsolationRule, root: string, project: Project): readonly Finding[] => {
  const groupOf = groupReader(root, rule.siblings);
  const groups = new Set(project.files.map(groupOf).filter((group) => group !== null));

  if (groups.size === 0) {
    return [
      {
        severity: "error",
        message: `\`${rule.siblings}\` matches no directory, so nothing is being kept apart`,
        file: null,
        start: null,
      },
    ];
  }

  if (groups.size === 1) {
    return [
      {
        severity: "warning",
        message: `\`${rule.siblings}\` matches only ${[...groups].join("")}, so it is keeping nothing apart yet`,
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

export function isolationClaim(rules: readonly IsolationRule[]): Claim {
  return {
    name: "no-sibling-directory-reaches-another",
    guidance: GUIDANCE,
    check: ({ root, project }) => rules.flatMap((rule) => findingsFor(rule, root, project)),
  };
}
