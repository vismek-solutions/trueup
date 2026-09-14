import { describe, expect, it } from "vitest";
import { parseModule, readDeclarations, readMentions } from "../../src/adapters/oxc-parse.ts";
import type { ImportStatement } from "../../src/ports/module-record.ts";

const importsIn = (source: string): readonly ImportStatement[] => parseModule("/p/a.ts", source).imports;

const bindingsIn = (source: string) => importsIn(source)[0]?.bindings ?? [];

const exportsIn = (source: string) => parseModule("/p/a.ts", source).exports;

const declaredIn = (source: string) => readDeclarations("/p/a.ts", source);

const mentionedIn = (source: string, path = "/p/a.ts") =>
  readMentions(path, source).map((mention) => `${mention.form}:${mention.text}`);

describe("what an import statement binds", () => {
  it("calls a default import by the name every default goes by", () => {
    expect(bindingsIn('import def from "./a.ts";\n')).toEqual([
      { imported: "default", local: "def", kind: "value", start: 7 },
    ]);
  });

  it("calls a namespace import by the name every namespace goes by", () => {
    expect(bindingsIn('import * as ns from "./a.ts";\n')[0]?.imported).toBe("*");
  });

  it("keeps the imported name apart from the local one, so a rename is still traceable", () => {
    expect(bindingsIn('import { two as alias } from "./a.ts";\n')).toEqual([
      { imported: "two", local: "alias", kind: "value", start: 16 },
    ]);
  });

  it("marks a statement-level type import as a type edge", () => {
    expect(bindingsIn('import type { Shape } from "./a.ts";\n')[0]?.kind).toBe("type");
  });

  it("marks an inline type specifier as a type edge, and its neighbour as a value", () => {
    const bindings = bindingsIn('import { type Inline, value } from "./a.ts";\n');

    expect(bindings.map((binding) => binding.kind)).toEqual(["type", "value"]);
  });

  it("keeps a side-effect import, which binds nothing but still reaches a file", () => {
    expect(importsIn('import "./side.ts";\n')).toEqual([{ specifier: "./side.ts", start: 0, bindings: [] }]);
  });

  it("carries the position of each binding rather than of the statement", () => {
    const [statement] = importsIn('import { one, two } from "./a.ts";\n');

    expect(statement?.start).toBe(0);
    expect(statement?.bindings.map((binding) => binding.start)).toEqual([9, 14]);
  });
});

describe("what an import awaited at runtime binds", () => {
  it("binds the whole module, because the call names a module and no name inside it", () => {
    expect(importsIn('const late = import("./a.ts");\n')).toEqual([
      { specifier: "./a.ts", start: 13, bindings: [{ imported: "*", local: "*", kind: "value", start: 20 }] },
    ]);
  });

  it("reads a specifier written in backticks, which is a literal path like any other", () => {
    expect(importsIn("const late = import(`./a.ts`);\n")[0]?.specifier).toBe("./a.ts");
  });

  it("skips a specifier the program fills in as it runs, rather than guessing a path", () => {
    expect(importsIn(`const late = (name: string) => import(\`./\${name}.ts\`);\n`)).toEqual([]);
  });

  it("skips a specifier joined from pieces, which starts and ends with a quote like a path does", () => {
    expect(importsIn('const late = (name: string) => import("./" + name + ".ts");\n')).toEqual([]);
  });

  it("skips an import written in a type position, which loads nothing at runtime", () => {
    expect(importsIn('type Shape = import("./a.ts").Shape;\n')).toEqual([]);
  });

  it("returns the statements in the order the file writes them", () => {
    const source = 'const late = import("./b.ts");\nimport { one } from "./a.ts";\n';

    expect(importsIn(source).map((statement) => statement.specifier)).toEqual(["./b.ts", "./a.ts"]);
  });
});

describe("what an export statement publishes", () => {
  it("reads a local export, keeping the name it was declared under", () => {
    expect(exportsIn("const local = 1;\nexport { local as renamed };\n")).toEqual([
      { form: "local", exported: "renamed", local: "local", kind: "value", start: 26 },
    ]);
  });

  it("reads a default export as a local one under the default name", () => {
    expect(exportsIn("const local = 1;\nexport default local;\n")[0]).toMatchObject({
      form: "local",
      exported: "default",
      local: "local",
    });
  });

  it("reads a star re-export, which publishes names it cannot list", () => {
    expect(exportsIn('export * from "./star.ts";\n')).toEqual([
      { form: "re-export-star", specifier: "./star.ts", kind: "value", start: 0 },
    ]);
  });

  it("reads a namespace re-export, which publishes one name standing for a module", () => {
    expect(exportsIn('export * as ns from "./m.ts";\n')[0]).toMatchObject({
      form: "re-export-namespace",
      exported: "ns",
      specifier: "./m.ts",
    });
  });

  it("reads a named re-export, keeping both sides so the far name stays followable", () => {
    expect(exportsIn('export { thing } from "./m.ts";\n')[0]).toMatchObject({
      form: "re-export-named",
      exported: "thing",
      imported: "thing",
      specifier: "./m.ts",
    });
  });

  it("reads a default brought through a re-export under a new name", () => {
    expect(exportsIn('export { default as brought } from "./m.ts";\n')[0]).toMatchObject({
      imported: "default",
      exported: "brought",
    });
  });

  it("marks a type-only re-export as a type edge", () => {
    expect(exportsIn('export type { Shape } from "./m.ts";\n')[0]?.kind).toBe("type");
  });
});

describe("whether a file uses module syntax at all", () => {
  it("says so when it imports or exports", () => {
    expect(parseModule("/p/a.ts", 'import "./a.ts";\n').esm).toBe(true);
  });

  it("says otherwise for a file that does neither", () => {
    expect(parseModule("/p/a.ts", "const a = 1;\n").esm).toBe(false);
  });
});

describe("the declarations a file makes", () => {
  it("reads each kind that carries a name of its own", () => {
    const source = [
      "export function fn(a: number) { return a; }",
      "export class Cls { run() {} }",
      "export type Alias = { a: number };",
      "export interface Face { a: number }",
      "export enum Colour { Red }",
      "declare module Mod { const x: number; }",
    ].join("\n");

    expect(declaredIn(source).map((found) => found.name)).toEqual([
      "fn",
      "Cls",
      "Alias",
      "Face",
      "Colour",
      "Mod",
    ]);
  });

  it("reads every binding in one variable statement, not just the first", () => {
    expect(declaredIn("const one = 1, two = 2;\n").map((found) => found.name)).toEqual(["one", "two"]);
  });

  it("takes the text after the name, so two functions differing only in name are one shape", () => {
    expect(declaredIn("function fn(a: number) { return a; }\n")[0]?.text).toBe("(a: number) { return a; }");
  });

  it("looks through an export wrapper to the declaration it carries", () => {
    expect(declaredIn("export function fn() {}\n")[0]).toMatchObject({ name: "fn", start: 7 });
  });

  it("reads a named default export, whose name is still a name", () => {
    expect(declaredIn("export default function named() { return 1; }\n").map((f) => f.name)).toEqual([
      "named",
    ]);
  });

  it("says nothing about a declaration with no name to report", () => {
    expect(declaredIn("export default function () { return 1; }\n")).toEqual([]);
  });

  it("says nothing about a statement that declares nothing", () => {
    expect(declaredIn("callSomething();\n")).toEqual([]);
  });

  it("says nothing about a destructured binding, which carries no name of its own", () => {
    expect(declaredIn("const { a } = obj;\n")).toEqual([]);
  });

  it("reads past an export that carries no declaration, rather than tripping over it", () => {
    expect(declaredIn("const a = 1;\nexport { a };\n").map((found) => found.name)).toEqual(["a"]);
  });
});

describe("the names and strings a file mentions", () => {
  it("reads an identifier and a string literal, which is what a seam rule reads", () => {
    expect(mentionedIn('const name = "a literal";\n')).toEqual(["name:name", "string:a literal"]);
  });

  it("says nothing about a number, which names nothing", () => {
    expect(mentionedIn("const n = 42;\n")).toEqual(["name:n"]);
  });

  it("skips an import declaration, whose names belong to the module it came from", () => {
    expect(mentionedIn('import { skipped } from "./m.ts";\n')).toEqual([]);
  });

  it("skips a star re-export the same way", () => {
    expect(mentionedIn('export * from "./m.ts";\n')).toEqual([]);
  });

  it("skips a dynamic import's specifier, which is a module request rather than a mention", () => {
    expect(mentionedIn('const dynamic = import("./dyn.ts");\n')).toEqual(["name:dynamic"]);
  });

  it("reads a name a file exports, since it declared that name itself", () => {
    expect(mentionedIn("export const own = 1;\n")).toEqual(["name:own"]);
  });

  it("reads no mention of the words between jsx tags, which are prose and not names", () => {
    expect(mentionedIn("const El = <Widget>plain text</Widget>;\n", "/p/view.tsx")).toEqual([
      "name:El",
      "name:Widget",
      "name:Widget",
    ]);
  });

  it("reads jsx element and attribute names, which is where a domain word usually leaks", () => {
    expect(mentionedIn('const El = <Widget name="x" />;\n', "/p/view.tsx")).toEqual([
      "name:El",
      "name:Widget",
      "name:name",
      "string:x",
    ]);
  });

  it("carries the position of each mention, so a finding can point at it", () => {
    expect(readMentions("/p/a.ts", "const name = 1;\n")[0]?.start).toBe(6);
  });
});
