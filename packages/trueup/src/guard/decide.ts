import { relative } from "node:path";
import type { Decision } from "../ports/proposal.ts";
import type { Report } from "../report/model.ts";
import { nested } from "./nesting.ts";

const ALLOW: Decision = { verdict: "allow", reasons: [] };

export interface RefusedFinding {
  readonly file: string | null;
  readonly message: string;
}

export interface Refusal {
  readonly claim: string;
  readonly file: string | null;
  readonly findings: readonly RefusedFinding[];
  readonly guidance: string;
}

export type ReasonOf = (refusal: Refusal) => string;

const findingText = ({ file, message }: RefusedFinding): string => {
  const [first = "", ...rest] = message.split("\n");

  return nested([`${file === null ? "" : `${file}  `}${first}`, ...rest.map((line) => `  ${line}`)].join("\n"));
};

const plainReason: ReasonOf = ({ claim, file, findings, guidance }) =>
  [file === null ? claim : `${claim}  ${file}`, ...findings.map(findingText), "  ────────", nested(guidance)].join(
    "\n",
  );

export interface DecideInput {
  readonly report: Report;
  readonly path: string | null;
  readonly root: string;
  readonly arriving?: boolean | undefined;
  readonly deferred?: readonly string[] | undefined;
  readonly reasonOf?: ReasonOf | undefined;
}

const RELOCATED = "no-declaration-is-written-twice";

const shortened = (root: string, file: string): string => relative(root, file) || file;

export function decideOnProposal({
  report,
  path,
  root,
  arriving = false,
  deferred = [],
  reasonOf = plainReason,
}: DecideInput): Decision {
  const passing = new Set(arriving ? [...deferred, RELOCATED] : deferred);
  const reasons = report.claims.flatMap((claim) => {
    if (passing.has(claim.claim)) return [];

    const hits = claim.findings.filter(
      (finding) => finding.severity === "error" && (path === null || finding.file === path),
    );
    if (hits.length === 0) return [];

    return [
      reasonOf({
        claim: claim.claim,
        file: path === null ? null : shortened(root, path),
        findings: hits.map((hit) => ({
          file: path !== null || hit.file === null ? null : shortened(root, hit.file),
          message: hit.message,
        })),
        guidance: claim.guidance,
      }),
    ];
  });

  return reasons.length === 0 ? ALLOW : { verdict: "deny", reasons };
}
