import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createResolver } from "../../src/adapters/oxc-resolve.ts";
import type { Resolution } from "../../src/ports/resolve.ts";

const EXTERNALS = ["astro:*", "virtual.mod"];

const planted = (): string => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "trueup-resolve-")));
  const put = (path: string, text: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text, "utf8");
  };

  put("tsconfig.json", JSON.stringify({ compilerOptions: { paths: { "@alias/*": ["./aliased/*"] } } }));
  put("aliased/target.ts", "export const target = 1;\n");
  put("src/from.ts", "export const from = 1;\n");
  put("src/typed.tsx", "export const typed = 1;\n");
  put("src/sugared.jsx", "export const sugared = 1;\n");
  put("src/real.js", "export const real = 1;\n");
  put("src/modern.mts", "export const modern = 1;\n");
  put("src/plainModern.mjs", "export const plainModern = 1;\n");
  put("src/legacy.cts", "export const legacy = 1;\n");
  put(
    "node_modules/conditions/package.json",
    JSON.stringify({
      name: "conditions",
      exports: {
        "./by-import": { import: "./i.js" },
        "./by-module": { module: "./mo.js" },
        "./by-node": { node: "./n.js" },
        "./by-anyone": { default: "./d.js" },
      },
    }),
  );
  put("node_modules/conditions/i.js", "export const i = 1;\n");
  put("node_modules/conditions/mo.js", "export const mo = 1;\n");
  put("node_modules/conditions/n.js", "export const n = 1;\n");
  put("node_modules/conditions/d.js", "export const d = 1;\n");
  put("node_modules/modular/package.json", JSON.stringify({ name: "modular", module: "./m.js" }));
  put("node_modules/modular/m.js", "export const m = 1;\n");
  put("node_modules/classic/package.json", JSON.stringify({ name: "classic", main: "./c.js" }));
  put("node_modules/classic/c.js", "exports.c = 1;\n");
  return root;
};

const resolved = (specifier: string): Resolution =>
  createResolver({ externals: EXTERNALS })(join(planted(), "src/from.ts"), specifier);

const resolvesTo = (specifier: string, path: string): void => {
  const root = planted();
  const found = createResolver({ externals: EXTERNALS })(join(root, "src/from.ts"), specifier);

  expect(found).toEqual({ kind: "path", path: join(root, path) });
};

const bareProject = (): string => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "trueup-resolve-bare-")));
  writeFileSync(join(root, "from.ts"), "export const from = 1;\n", "utf8");
  return root;
};

describe("resolving a specifier the way the project's own tooling would", () => {
  it("answers with the path of the file the specifier names", () => {
    resolvesTo("./real.js", "src/real.js");
  });

  it("reads a `.js` specifier as the TypeScript file that will be compiled to it", () => {
    resolvesTo("./typed.js", "src/typed.tsx");
  });

  it("reads a `.js` specifier as the JSX file beside it too", () => {
    resolvesTo("./sugared.js", "src/sugared.jsx");
  });

  it("reads an `.mjs` specifier the same way", () => {
    resolvesTo("./modern.mjs", "src/modern.mts");
  });

  it("still finds a real `.mjs` file under that specifier", () => {
    resolvesTo("./plainModern.mjs", "src/plainModern.mjs");
  });

  it("reads a `.cjs` specifier as the `.cts` file beside it", () => {
    resolvesTo("./legacy.cjs", "src/legacy.cts");
  });

  it("follows a path alias declared in the nearest tsconfig", () => {
    resolvesTo("@alias/target", "aliased/target.ts");
  });

  it("names a builtin rather than looking for a file", () => {
    expect(resolved("node:path")).toEqual({ kind: "builtin", name: "node:path" });
  });

  it("says what it could not find, rather than answering with no path", () => {
    expect(resolved("./nope.ts")).toEqual({
      kind: "unresolved",
      reason: expect.stringContaining("./nope.ts"),
    });
  });
});

describe("reaching into a package", () => {
  it("takes the export an importer gets, not the one a require would", () => {
    resolvesTo("conditions/by-import", "node_modules/conditions/i.js");
  });

  it("takes an export offered only to a bundler", () => {
    resolvesTo("conditions/by-module", "node_modules/conditions/mo.js");
  });

  it("takes an export offered only to node", () => {
    resolvesTo("conditions/by-node", "node_modules/conditions/n.js");
  });

  it("takes an export a package offers to anyone at all", () => {
    resolvesTo("conditions/by-anyone", "node_modules/conditions/d.js");
  });

  it("falls back to the module field of a package that declares no main", () => {
    resolvesTo("modular", "node_modules/modular/m.js");
  });

  it("still reads the main field of a package that declares nothing else", () => {
    resolvesTo("classic", "node_modules/classic/c.js");
  });
});

describe("specifiers the project says something else supplies", () => {
  it("reports a match as external instead of looking for it on disk", () => {
    expect(resolved("astro:content")).toEqual({ kind: "external", name: "astro:content" });
  });

  it("takes a dot in a pattern as a dot, not as any character", () => {
    expect(resolved("virtual.mod")).toEqual({ kind: "external", name: "virtual.mod" });
    expect(resolved("virtualXmod").kind).not.toBe("external");
  });

  it("supplies nothing when the project named no externals", () => {
    const root = bareProject();

    expect(createResolver()(join(root, "from.ts"), "astro:content").kind).toBe("unresolved");
  });
});

describe("asking the same question twice", () => {
  it("answers from the first answer, so a file written afterwards is not seen", () => {
    const root = bareProject();
    const from = join(root, "from.ts");
    const resolve = createResolver();

    expect(resolve(from, "./later.ts").kind).toBe("unresolved");
    writeFileSync(join(root, "later.ts"), "export const later = 1;\n", "utf8");

    expect(resolve(from, "./later.ts").kind).toBe("unresolved");
  });
});
