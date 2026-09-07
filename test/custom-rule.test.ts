import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defineRule } from "../src/claims/custom.ts";
import { check } from "../src/compose.ts";
import type { Project } from "../src/project/model.ts";
import type { ClaimResult } from "../src/report/model.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "seam");

const ZONES = [
  { name: "domain", patterns: ["domain/**"] },
  { name: "engine", patterns: ["engine/**"] },
];

const runRule = (rule: ReturnType<typeof defineRule>): ClaimResult => {
  const report = check({ root: ROOT, zones: ZONES, rules: [rule] });
  const result = report.claims.find((claim) => claim.claim === rule.name);
  if (result === undefined) throw new Error(`no result for ${rule.name}`);
  return result;
};

const captureProject = (): { readonly get: () => Project } => {
  let captured: Project | null = null;
  const rule = defineRule("capture", (project) => {
    captured = project;
    return [];
  });
  check({ root: ROOT, zones: ZONES, rules: [rule] });
  return {
    get: () => {
      if (captured === null) throw new Error("rule never ran");
      return captured;
    },
  };
};

describe("a rule written in TypeScript", () => {
  it("runs as a claim of its own name", () => {
    expect(runRule(defineRule("my-rule", () => [])).claim).toBe("my-rule");
  });

  it("turns a bare message into an error finding", () => {
    const result = runRule(defineRule("bare", () => [{ message: "something" }]));
    expect(result.findings).toEqual([{ severity: "error", message: "something", file: null, start: null }]);
  });

  it("carries a file and position through when the rule supplies them", () => {
    const result = runRule(
      defineRule("located", (project) => [
        { message: "here", file: project.filesIn("engine")[0], at: 7, severity: "warning" },
      ]),
    );
    expect(result.findings[0]?.severity).toBe("warning");
    expect(result.findings[0]?.start).toBe(7);
    expect(result.findings[0]?.file).toContain("engine");
  });

  it("can express a boundary from the import query alone", () => {
    const result = runRule(
      defineRule("engine-may-not-reach-domain", (project) =>
        project
          .imports({ fromZone: "engine", declaredZone: "domain" })
          .map((entry) => ({ message: `${project.relative(entry.from)} takes ${entry.imported}`, file: entry.from })),
      ),
    );

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.message).toBe("engine/legit.ts takes Warrant");
  });
});

describe("the project a rule receives", () => {
  const project = captureProject();

  it("reports the zone a file belongs to", () => {
    const engine = project.get().filesIn("engine");
    expect(engine.every((file) => project.get().zoneOf(file) === "engine")).toBe(true);
  });

  it("separates the module a specifier named from the file that declares the symbol", () => {
    const [edge] = project.get().imports({ fromZone: "engine", declaredZone: "domain" });
    expect(edge?.via).toBe(join(ROOT, "domain/warrant.ts"));
    expect(edge?.symbol).toBe("Warrant");
  });

  it("lists the names a file exports", () => {
    expect([...project.get().exportsOf(join(ROOT, "domain/warrant.ts"))].sort()).toEqual([
      "Warrant",
      "WarrantKind",
      "warrantKinds",
    ]);
  });

  it("derives a zone's vocabulary without being told the words", () => {
    const vocabulary = project.get().vocabularyOf(["domain"]);
    expect(vocabulary.names.has("Warrant")).toBe(true);
    expect(vocabulary.literals.has("testimony")).toBe(true);
  });

  it("names every declared zone", () => {
    expect(project.get().zoneNames).toEqual(["domain", "engine"]);
  });
});
