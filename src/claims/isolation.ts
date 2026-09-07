import { relative, sep } from "node:path";
import picomatch from "picomatch";
import type { Project, ResolvedImport } from "../project/model.ts";
import type { Finding } from "../report/model.ts";
import type { Claim } from "./model.ts";

const GUIDANCE =
  "Two directories that were meant to stand alone are reaching into each other. Siblings under the same parent are separate parts, and once one imports another neither can be read, moved or deleted without the other, so the parent stops being a set of parts and becomes one unit. Move what they share up to a directory both may reach, or out of the group entirely, and import it from there. Listing the sibling in `except` is not the fix: that is for a directory everyone is meant to share, not for the one case you would like to allow today.";

export interface IsolationRule {
  readonly siblings: string;
  readonly except?: readonly string[] | undefined;
}

type GroupOf = (file: string) => string | null;

const posix = (path: string): string => (sep === "/" ? path : path.split(sep).join("/"));

const groupReader = (root: string, pattern: string): GroupOf => {
  const expression = picomatch.makeRe(`${pattern}/**`, { dot: true, capture: true });

  return (file) => {
    const captured = expression.exec(posix(relative(root, file)));
    if (captured === null) return null;

    const segments = captured.slice(1, -1).filter((segment) => segment !== undefined && segment !== "");
    return segments.length === 0 ? null : segments.join("/");
  };
};

const breachOf = (
  edge: ResolvedImport,
  groupOf: GroupOf,
  excepted: ReadonlySet<string>,
  project: Project,
): Finding | null => {
  if (edge.declaredIn === null) return null;

  const from = groupOf(edge.from);
  const to = groupOf(edge.declaredIn);
  if (from === null || to === null || from === to) return null;
  if (excepted.has(from) || excepted.has(to)) return null;

  return {
    severity: "error",
    message: `is ${from} and may not reach sibling ${to}: ${edge.imported} from ${project.relative(edge.declaredIn)}`,
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

  const excepted = new Set(rule.except ?? []);
  return project
    .imports()
    .map((edge) => breachOf(edge, groupOf, excepted, project))
    .filter((finding) => finding !== null);
};

export function isolationClaim(rules: readonly IsolationRule[]): Claim {
  return {
    name: "no-sibling-directory-reaches-another",
    guidance: GUIDANCE,
    check: ({ root, project }) => rules.flatMap((rule) => findingsFor(rule, root, project)),
  };
}
