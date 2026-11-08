import picomatch from "picomatch";
import type { ChangeSet, Changes, FileChange } from "../../ports/changes.ts";
import type { Severity } from "../../ports/severity.ts";
import type { Finding } from "../../report/model.ts";
import type { Claim } from "../model.ts";

const GUIDANCE = `This change is too large to review.

Do this:
- Land part of what is already done on its own, such as a move, a rename or a new module with its tests.
- Split where the whole tree is green, not by file at the end.
- If a generated, vendored or lock file grew, name it in \`except\`.

Not the fix: raising the budget because the work is nearly done.

This claim is never recorded in the baseline.`;

const UNMEASURED = `Nothing was held to the review budget, because the change could not be measured.

Do this:
- Fix the cause the finding names.`;

const REVIEW_CLAIM = "no-change-outgrows-its-review";

const DEFAULT_BASE = "main";

const SHOWN = 3;

export interface ReviewBudget {
  readonly additions: number;
  readonly deletions: number;
  readonly severity?: Severity | undefined;
  readonly nearing?: number | undefined;
  readonly base?: string | undefined;
  readonly except?: readonly string[] | undefined;
}

const heaviest = (files: readonly FileChange[]): string =>
  [...files]
    .sort((left, right) => right.added + right.removed - (left.added + left.removed))
    .slice(0, SHOWN)
    .map((file) => `${file.file} +${file.added}/-${file.removed}`)
    .join(", ");

const finding = (severity: Severity, message: string): Finding => ({
  severity,
  message,
  file: null,
  start: null,
});

export interface ChangeSize {
  readonly added: number;
  readonly removed: number;
  readonly files: readonly FileChange[];
}

export const sizeOf = (changed: readonly FileChange[], budget: ReviewBudget): ChangeSize => {
  const except = budget.except;
  const spared = except === undefined || except.length === 0 ? null : picomatch([...except], { dot: true });
  const files = spared === null ? [...changed] : changed.filter((file) => !spared(file.file));

  return {
    added: files.reduce((total, file) => total + file.added, 0),
    removed: files.reduce((total, file) => total + file.removed, 0),
    files,
  };
};

const sizedIn = (budget: ReviewBudget, base: string, changed: readonly FileChange[]): Finding[] => {
  const { added, removed, files } = sizeOf(changed, budget);

  const over = added > budget.additions || removed > budget.deletions;
  const edge = budget.nearing;
  const close = edge !== undefined && (added > budget.additions * edge || removed > budget.deletions * edge);
  if (!over && !close) return [];

  const cap = `+${budget.additions} / -${budget.deletions}`;
  const said = over ? "over" : "nearing";
  const where = `; heaviest: ${heaviest(files)}`;

  return [
    finding(
      over ? (budget.severity ?? "warning") : "warning",
      `+${added} / -${removed} against ${base}, ${said} the ${cap} a review can hold${where}`,
    ),
  ];
};

const budgetFindings = (budget: ReviewBudget, changed: ChangeSet): readonly Finding[] =>
  changed.kind === "unmeasured"
    ? [
        finding(
          "warning",
          `the change could not be measured, so nothing was held to the review budget: ${changed.reason}`,
        ),
      ]
    : sizedIn(budget, changed.base, changed.files);

export function reviewClaim(budget: ReviewBudget, changes: Changes): Claim {
  return {
    name: REVIEW_CLAIM,
    check: ({ root }) => {
      const changed = changes.since(root, budget.base ?? DEFAULT_BASE);

      return {
        findings: budgetFindings(budget, changed),
        guidance: changed.kind === "unmeasured" ? UNMEASURED : GUIDANCE,
      };
    },
  };
}
