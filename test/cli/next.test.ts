import { describe, expect, it } from "vitest";
import { renderNext } from "../../src/cli/render.ts";
import type { Finding, Report } from "../../src/report/model.ts";

const COVERAGE: Report["coverage"] = {
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

const error = (message: string, file: string, group?: string): Finding => ({
  severity: "error",
  message,
  file,
  start: null,
  ...(group === undefined ? {} : { group }),
});

const reportOf = (claims: Report["claims"]): Report => ({ claims, coverage: COVERAGE });

const COPIES = reportOf([
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

describe("showing one problem at a time", () => {
  it("keeps findings that share a cause together", () => {
    const output = renderNext(COPIES, "/p");

    expect(output).toContain("a.ts");
    expect(output).toContain("b.ts");
    expect(output).toContain("2 errors");
  });

  it("leaves the unrelated copy for a later pass", () => {
    expect(renderNext(COPIES, "/p")).not.toContain("c.ts");
  });

  it("counts the problems rather than the findings", () => {
    expect(renderNext(COPIES, "/p")).toContain("problem 1 of 3");
  });

  it("treats findings with no shared cause as one problem each", () => {
    const single = reportOf([COPIES.claims[1] as Report["claims"][number]]);
    expect(renderNext(single, "/p")).toContain("problem 1 of 1");
  });

  it("carries the guidance, since it is the whole point of showing one", () => {
    expect(renderNext(COPIES, "/p")).toContain("delete the rest");
  });

  it("says so when there is nothing left", () => {
    expect(renderNext(reportOf([]), "/p")).toContain("nothing left to fix");
  });
});
