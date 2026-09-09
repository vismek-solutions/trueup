import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inspect } from "../../src/compose.ts";
import type { Project, ResolvedImport } from "../../src/project/model.ts";
import { fixtureAt } from "../support/fixtures.ts";

const ROOT = fixtureAt("facade");

const projectAt = (): Project =>
  inspect({
    root: ROOT,
    zones: [
      { name: "engine", patterns: ["src/engine/**"] },
      { name: "domain", patterns: ["src/domain/**"] },
    ],
  });

const named = (project: Project, edges: readonly ResolvedImport[]): readonly string[] =>
  edges.map((edge) => `${project.relative(edge.from)} ${edge.imported}`).sort();

describe("what a rule is told about one import", () => {
  const thingFromEngine = (): ResolvedImport | undefined =>
    projectAt()
      .imports()
      .find((edge) => edge.fromZone === "engine" && edge.imported === "thing");

  it("names the zone reached into as well as the zone reaching", () => {
    expect(thingFromEngine()?.declaredZone).toBe("domain");
  });

  it("names the file the symbol is declared in, not the module it was imported from", () => {
    expect(thingFromEngine()?.declaredIn).toBe(join(ROOT, "src/domain/thing.ts"));
  });

  it("carries the symbol's own name, which a renamed import would otherwise lose", () => {
    expect(thingFromEngine()?.symbol).toBe("thing");
  });
});

describe("an import that reaches no file of ours", () => {
  const builtin = (): ResolvedImport | undefined =>
    projectAt()
      .imports()
      .find((edge) => edge.imported === "join");

  it("has no declaring file, since the declaration is outside the analysis", () => {
    expect(builtin()?.declaredIn).toBeNull();
  });

  it("has no declaring zone either, rather than borrowing the importer's", () => {
    expect(builtin()?.declaredZone).toBeNull();
  });

  it("has no symbol, since nothing here declares one to name", () => {
    expect(builtin()?.symbol).toBeNull();
  });
});

describe("an import of a whole module rather than a name in it", () => {
  const namespace = (): ResolvedImport | undefined =>
    projectAt()
      .imports()
      .find((edge) => edge.target.kind === "namespace");

  it("reaches the module's file, so a rule can still say which zone it entered", () => {
    expect(namespace()?.declaredIn).toBe(join(ROOT, "src/domain/thing.ts"));
    expect(namespace()?.declaredZone).toBe("domain");
  });

  it("carries no symbol, since it named no single declaration", () => {
    expect(namespace()?.symbol).toBeNull();
  });
});

describe("an import of a name the module never exported", () => {
  const absent = (): ResolvedImport | undefined =>
    projectAt()
      .imports()
      .find((edge) => edge.imported === "absent");

  it("names the module that was asked, so a rule still sees the zone that was reached", () => {
    expect(absent()?.declaredIn).toBe(join(ROOT, "src/domain/thing.ts"));
    expect(absent()?.declaredZone).toBe("domain");
  });
});

describe("an import two files both answer", () => {
  const disputed = (): ResolvedImport | undefined =>
    projectAt()
      .imports()
      .find((edge) => edge.imported === "disputed");

  it("has no declaring file, since neither candidate is the answer", () => {
    expect(disputed()?.declaredIn).toBeNull();
    expect(disputed()?.declaredZone).toBeNull();
  });
});

describe("an import that resolved to a file the analysis never read", () => {
  const built = (): ResolvedImport | undefined =>
    projectAt()
      .imports()
      .find((edge) => edge.imported === "built");

  it("has no declaring file, so a rule is not told about a file it cannot ask about", () => {
    expect(built()?.declaredIn).toBeNull();
    expect(built()?.declaredZone).toBeNull();
  });
});

describe("asking for a subset of the imports", () => {
  it("returns every edge when nothing is asked", () => {
    const project = projectAt();

    expect(named(project, project.imports())).toEqual([
      "src/domain/helper.ts thing",
      "src/engine/runner.ts *",
      "src/engine/runner.ts Shape",
      "src/engine/runner.ts absent",
      "src/engine/runner.ts built",
      "src/engine/runner.ts disputed",
      "src/engine/runner.ts join",
      "src/engine/runner.ts thing",
    ]);
  });

  it("narrows by the zone reaching", () => {
    const project = projectAt();

    expect(named(project, project.imports({ fromZone: "domain" }))).toEqual(["src/domain/helper.ts thing"]);
  });

  it("narrows by the zone reached into, which drops what resolved outside the analysis", () => {
    const project = projectAt();

    expect(named(project, project.imports({ declaredZone: "domain" }))).toEqual([
      "src/domain/helper.ts thing",
      "src/engine/runner.ts *",
      "src/engine/runner.ts Shape",
      "src/engine/runner.ts absent",
      "src/engine/runner.ts thing",
    ]);
  });

  it("narrows by kind, which is how a rule ignores type-only edges", () => {
    const project = projectAt();

    expect(named(project, project.imports({ kind: "type" }))).toEqual(["src/engine/runner.ts Shape"]);
  });

  it("applies every part of the query together rather than the first that matches", () => {
    const project = projectAt();

    expect(
      named(project, project.imports({ fromZone: "engine", declaredZone: "domain", kind: "value" })),
    ).toEqual(["src/engine/runner.ts *", "src/engine/runner.ts absent", "src/engine/runner.ts thing"]);
  });

  it("returns nothing when the parts of a query cannot both hold", () => {
    expect(projectAt().imports({ fromZone: "domain", kind: "type" })).toEqual([]);
  });
});

describe("what a rule can ask about the tree itself", () => {
  it("lists zones in the order they were declared, since the first match wins", () => {
    expect(projectAt().zoneNames).toEqual(["engine", "domain"]);
  });

  it("lists a zone's files", () => {
    const project = projectAt();

    expect(project.filesIn("domain").map((file) => project.relative(file))).toEqual([
      "src/domain/both.ts",
      "src/domain/helper.ts",
      "src/domain/left.ts",
      "src/domain/right.ts",
      "src/domain/thing.ts",
    ]);
  });

  it("reads a file's exported names, types among them", () => {
    expect(projectAt().exportsOf(join(ROOT, "src/domain/thing.ts"))).toEqual(["Shape", "thing"]);
  });

  it("gathers a zone's vocabulary from every file in it", () => {
    expect([...projectAt().vocabularyOf(["domain"]).names].sort()).toEqual([
      "Shape",
      "disputed",
      "helper",
      "thing",
    ]);
  });
});
