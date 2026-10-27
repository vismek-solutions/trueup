import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CACHE_DIRECTORY, cachedParse } from "../../src/adapters/parse/facts-cache.ts";
import { parseEach } from "../../src/adapters/parse/oxc-parse.ts";

const SOURCE = [
  "// the greeting a player sees",
  'export function greet(name: string) { return "hello " + name; }',
  "const twice = greet;",
  "",
].join("\n");

const rootWith = (): string => realpathSync(mkdtempSync(join(tmpdir(), "trueup-facts-")));

const freshly = (path: string, text: string) => parseEach(new Map([[path, text]])).get(path);

describe("parsing through the store", () => {
  it("answers from the store exactly as a fresh parse would, and writes nothing when every file was stored", () => {
    const root = rootWith();
    const path = join(root, "a.ts");
    const sources = new Map([[path, SOURCE]]);
    const store = join(root, CACHE_DIRECTORY, "facts.json");

    cachedParse(root)(sources);
    const written = statSync(store).mtimeMs;
    const stored = cachedParse(root)(sources);

    expect(stored.get(path)).toEqual(freshly(path, SOURCE));
    expect(statSync(store).mtimeMs, "an answer served whole from the store rewrote it").toBe(written);
  });

  it("parses a file again once its text changes, rather than serving what was stored for it", () => {
    const root = rootWith();
    const path = join(root, "a.ts");
    const changed = SOURCE.replace("twice", "thrice");

    cachedParse(root)(new Map([[path, SOURCE]]));

    expect(cachedParse(root)(new Map([[path, changed]])).get(path)).toEqual(freshly(path, changed));
  });

  it("trusts no store written by another parser, even for the same text", () => {
    const root = rootWith();
    const path = join(root, "a.ts");
    const hash = createHash("sha1").update(SOURCE).digest("base64");
    const record = { path, imports: [], exports: [], esm: false };
    const forged = { hash, record, names: [], mentions: [], declarations: [], comments: [] };
    mkdirSync(join(root, CACHE_DIRECTORY));
    writeFileSync(
      join(root, CACHE_DIRECTORY, "facts.json"),
      JSON.stringify({ parser: "another", files: { [path]: forged } }),
    );

    expect(cachedParse(root)(new Map([[path, SOURCE]])).get(path)).toEqual(freshly(path, SOURCE));
  });
});
