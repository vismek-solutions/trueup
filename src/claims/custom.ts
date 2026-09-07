import type { Issue, Project } from "../project/model.ts";
import type { Finding } from "../report/model.ts";
import type { Claim } from "./model.ts";

export interface Rule {
  readonly name: string;
  readonly check: (project: Project) => readonly Issue[];
}

export const defineRule = (name: string, check: (project: Project) => readonly Issue[]): Rule => ({ name, check });

const toFinding = (issue: Issue): Finding => ({
  severity: issue.severity ?? "error",
  message: issue.message,
  file: issue.file ?? null,
  start: issue.at ?? null,
});

export const customClaims = (rules: readonly Rule[]): readonly Claim[] =>
  rules.map((rule) => ({
    name: rule.name,
    check: ({ project }) => rule.check(project).map(toFinding),
  }));
