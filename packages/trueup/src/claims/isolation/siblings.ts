import { relative } from "node:path";
import picomatch from "picomatch";
import { toPosix } from "../../paths/posix.ts";
import type { Project, ResolvedImport } from "../../project/model.ts";
import type { Finding } from "../../report/model.ts";
import type { Claim } from "../model.ts";
import { groupReader, type GroupOf } from "./groups.ts";
import { reachWording, type Sharing, type SiblingException, sharingOf } from "./sharing.ts";

const GUIDANCE = `A directory reaches into a sibling that was meant to stand alone.

Do this:
- Move what they share to a directory both may reach, or out of the group, and import it from there.

Not the fix:
- Listing the reached-into sibling in \`except\`. That is for a directory every sibling is meant to share.
- Widening the pattern so the two stop being siblings.

\`except\` matches a group name as a pattern, so name the convention, not the instances. It exempts a directory as a target only.

A shared directory written as \`{ shared, allow }\` reaches only the shared siblings its \`allow\` matches. When one reaches against that, move the reaching code into the directory it reached, or into one allowed to reach both, rather than adding the reached directory to \`allow\`.

When a rule matches too few directories, fix the pattern if it was meant to reach a level deeper.`;

const LOOSE = `A file sits directly in the parent of an isolated group, so it belongs to no sibling and the rule does not govern it.

Do this:
- Move it into the sibling that uses it.
- Move it out of the parent if several siblings use it.
- If its job is the group itself, such as an index or a route manifest, name it in \`wiring\`.

Not the fix: listing a file in \`wiring\` because you have not decided where it belongs.

\`wiring\` matches the path as a pattern, so name the convention, not the instances.`;

export interface IsolationRule {
  readonly siblings: string;
  readonly except?: readonly SiblingException[] | undefined;
  readonly wiring?: readonly string[] | undefined;
}

interface Grouping {
  readonly groupOf: GroupOf;
  readonly sharing: Sharing;
  readonly project: Project;
}

const refusalOf = (from: string, to: string, sharing: Sharing): string | null => {
  if (!sharing.shares(to)) {
    return sharing.shares(from)
      ? `is ${from}, which the group shares, and may not reach into sibling ${to}`
      : `is ${from} and may not reach sibling ${to}`;
  }
  const withheld = sharing.withheld(from, to);
  return withheld === null ? null : `is ${from}, ${reachWording(withheld)}, and may not reach ${to}`;
};

const breachOf = (edge: ResolvedImport, { groupOf, sharing, project }: Grouping): Finding | null => {
  if (edge.declaredIn === null) return null;

  const from = groupOf(edge.from);
  const to = groupOf(edge.declaredIn);
  if (from === null || to === null || from === to) return null;

  const refusal = refusalOf(from, to, sharing);
  if (refusal === null) return null;

  return {
    severity: "error",
    message: `${refusal}: ${edge.imported} from ${project.relative(edge.declaredIn)}`,
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

  const grouping: Grouping = { groupOf, sharing: sharingOf(rule.except), project };
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
  readonly withheld: readonly string[];
  readonly assembles: boolean;
}

const insideGroup = (rule: IsolationRule, names: readonly string[], group: string): SiblingPlacement => {
  const sharing = sharingOf(rule.except);
  const others = names.filter((name) => name !== group);
  const shared = others.filter((name) => sharing.shares(name));

  return {
    siblings: rule.siblings,
    group,
    apart: others.filter((name) => !sharing.shares(name)),
    shared: shared.filter((name) => sharing.withheld(group, name) === null),
    withheld: shared.filter((name) => sharing.withheld(group, name) !== null),
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
        withheld: [],
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
    check: ({ root, project }) => ({
      findings: rules.flatMap((rule) => looseIn(rule, root, project)),
      guidance: LOOSE,
    }),
  };
}

export function isolationClaim(rules: readonly IsolationRule[]): Claim {
  return {
    name: "no-sibling-directory-reaches-another",
    check: ({ root, project }) => ({
      findings: rules.flatMap((rule) => findingsFor(rule, root, project)),
      guidance: GUIDANCE,
    }),
  };
}
