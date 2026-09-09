import type { Finding, Report } from "../../src/report/model.ts";

export const COVERAGE: Report["coverage"] = {
  files: 3,
  edges: 2,
  symbolEdges: 2,
  namespaceEdges: 0,
  externalEdges: 0,
  builtinEdges: 0,
  unresolvedImports: 0,
  filesByZone: { app: 3 },
  unclassifiedFiles: 0,
};

export const reportOf = (claims: Report["claims"]): Report => ({ claims, coverage: COVERAGE });

export const error = (message: string, file: string | null, group?: string): Finding => ({
  severity: "error",
  message,
  file,
  start: null,
  ...(group === undefined ? {} : { group }),
});

export const warning = (message: string, file: string | null): Finding => ({
  severity: "warning",
  message,
  file,
  start: null,
});

export const kept = (message: string, file: string | null): Finding => ({
  severity: "warning",
  message,
  file,
  start: null,
  accepted: true,
});

const GUIDANCE =
  "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo";

export const MIXED = reportOf([
  { claim: "a-passing-claim", guidance: "never shown", findings: [] },
  {
    claim: "a-mixed-claim",
    guidance: GUIDANCE,
    findings: [error("an error here", "/p/a.ts"), warning("a warning here", null)],
  },
  {
    claim: "a-warning-claim",
    guidance: "just the one",
    findings: [warning("only a warning", "/p/b.ts")],
  },
]);

export const COPIES = reportOf([
  {
    claim: "no-declaration-is-written-twice",
    guidance: "Keep one, put it where every caller may reach it, and delete the rest.",
    findings: [
      error("declares posix, written the same way elsewhere", "/p/a.ts", "body-one"),
      error("declares posix, written the same way elsewhere", "/p/b.ts", "body-one"),
      error("declares toSlug, written the same way elsewhere", "/p/c.ts", "body-two"),
    ],
  },
  {
    claim: "every-import-respects-its-zone-boundary",
    guidance: "Move the code to a zone that may reach the target.",
    findings: [error("is app and may not reach domain", "/p/d.ts")],
  },
]);
