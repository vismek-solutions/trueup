import { describe, expect, it } from "vitest";
import { buildLexicon } from "../../src/lexicon/build.ts";
import type { Lexicon } from "../../src/lexicon/model.ts";
import type { ModuleRecord, ReadProse } from "../../src/ports/module-record.ts";

const FILE = "/p/a.ts";
const UNREAD = "/p/never-read.ts";

const record: ModuleRecord = {
  path: FILE,
  imports: [
    {
      specifier: "./b.ts",
      start: 0,
      bindings: [{ imported: "thing", local: "renamed", kind: "value", start: 9 }],
    },
  ],
  exports: [
    { form: "local", exported: "kept", local: "kept", kind: "value", start: 30 },
    { form: "re-export-star", specifier: "./c.ts", kind: "value", start: 60 },
  ],
  esm: true,
};

interface Counted {
  readonly lexicon: Lexicon;
  readonly parses: () => number;
}

const counting = (): Counted => {
  let parses = 0;
  const readProse: ReadProse = () => {
    parses += 1;
    return { strings: [{ text: "kept", start: 6, end: 10 }], joined: [] };
  };

  return {
    lexicon: buildLexicon({
      facts: new Map([
        [
          FILE,
          {
            record,
            mentions: [{ text: "kept", form: "name", start: 6 }],
            declarations: [{ name: "kept", text: " = 1", start: 6, end: 14 }],
            comments: [],
          },
        ],
      ]),
      sources: new Map([[FILE, "const kept = 1"]]),
      readProse,
    }),
    parses: () => parses,
  };
};

describe("reading a file's prose more than once", () => {
  it("parses it once, however many rules ask, and gives the same answer the second time", () => {
    const { lexicon, parses } = counting();

    expect(lexicon.proseIn(FILE)).toEqual(lexicon.proseIn(FILE));
    expect(parses()).toBe(1);
  });
});

describe("asking about a file the analysis never read", () => {
  it("finds no declarations, rather than reaching for the disk", () => {
    expect(counting().lexicon.declarationsIn(UNREAD)).toEqual([]);
  });

  it("finds no mentions", () => {
    expect(counting().lexicon.mentionsIn(UNREAD)).toEqual([]);
  });

  it("parses nothing at all for it", () => {
    const { lexicon, parses } = counting();

    expect(lexicon.proseIn(UNREAD)).toEqual({ strings: [], joined: [] });
    expect(parses()).toBe(0);
  });

  it("finds no exported names", () => {
    expect(counting().lexicon.exportedNamesIn(UNREAD)).toEqual([]);
  });

  it("finds no imported names", () => {
    expect(counting().lexicon.importedNamesIn(UNREAD)).toEqual(new Set());
  });

  it("contributes nothing to a vocabulary that names it", () => {
    expect(counting().lexicon.vocabularyOf([UNREAD])).toEqual({ names: new Set(), literals: new Set() });
  });
});

describe("what a file is taken to declare and to reach for", () => {
  it("names what it exports, leaving out a star it only passes along", () => {
    expect(counting().lexicon.exportedNamesIn(FILE)).toEqual(["kept"]);
  });

  it("names an import by what this file calls it, not by what it was exported as", () => {
    expect(counting().lexicon.importedNamesIn(FILE)).toEqual(new Set(["renamed"]));
  });
});
