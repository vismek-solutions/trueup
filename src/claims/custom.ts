import type { Issue, Project } from "../project/model.ts";
import type { Finding } from "../report/model.ts";
import type { Claim } from "./model.ts";

export interface Rule {
  readonly name: string;
  readonly guidance: string;
  readonly check: (project: Project) => readonly Issue[];
}

const NO_GUIDANCE = "This rule is defined by this project's own configuration. Read it there for what it asserts.";

export const defineRule = (
  name: string,
  check: (project: Project) => readonly Issue[],
  guidance: string = NO_GUIDANCE,
): Rule => ({ name, guidance, check });

const toFinding = (issue: Issue): Finding => ({
  severity: issue.severity ?? "error",
  message: issue.message,
  file: issue.file ?? null,
  start: issue.at ?? null,
});

export const customClaims = (rules: readonly Rule[]): readonly Claim[] =>
  rules.map((rule) => ({
    name: rule.name,
    guidance: rule.guidance,
    check: ({ project }) => rule.check(project).map(toFinding),
  }));
