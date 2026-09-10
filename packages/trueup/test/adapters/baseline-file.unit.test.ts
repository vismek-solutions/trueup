import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { baselinePathIn, readBaseline, writeBaseline } from "../../src/adapters/baseline-file.ts";

const holding = (content: string): string => {
  const directory = mkdtempSync(join(tmpdir(), "trueup-baseline-"));
  const path = baselinePathIn(directory);
  writeFileSync(path, content, "utf8");
  return path;
};

const reading = (entries: unknown): (() => unknown) => {
  const path = holding(JSON.stringify({ entries }));
  return () => readBaseline(path);
};

const ENTRY = { claim: "a-claim", file: "src/x.ts", message: "said something" };

describe("reading a baseline off disk", () => {
  it("treats a file that is not there as a baseline with nothing in it", () => {
    const absent = baselinePathIn(mkdtempSync(join(tmpdir(), "trueup-baseline-")));

    expect(readBaseline(absent).entries).toEqual([]);
  });

  it("reads the entries it was given back in order", () => {
    expect(reading([ENTRY])()).toEqual({ entries: [ENTRY] });
  });

  it("accepts an entry that names no file, since a claim about the run itself has none", () => {
    const nowhere = { claim: "a-claim", file: null, message: "no file" };

    expect(reading([nowhere])()).toEqual({ entries: [nowhere] });
  });

  it("comes back from what it wrote, so a round trip changes nothing", () => {
    const path = baselinePathIn(mkdtempSync(join(tmpdir(), "trueup-baseline-")));
    writeBaseline(path, { entries: [ENTRY] });

    expect(readBaseline(path).entries).toEqual([ENTRY]);
  });
});

describe("refusing a baseline it cannot trust", () => {
  it("names the file it refused, so the failure is not a bare type error", () => {
    expect(reading("not a list")).toThrow("is not a baseline file");
  });

  it("refuses a file whose entries are not a list at all", () => {
    expect(reading({ claim: "a-claim" })).toThrow("is not a baseline file");
  });

  it("refuses a file with no entries key, rather than reading it as empty", () => {
    const path = holding(JSON.stringify({ recorded: [] }));

    expect(() => readBaseline(path)).toThrow("is not a baseline file");
  });

  it("refuses an entry that is null", () => {
    expect(reading([null])).toThrow("is not a baseline file");
  });

  it("refuses an entry that is not an object", () => {
    expect(reading(["a-claim"])).toThrow("is not a baseline file");
  });

  it("refuses an entry whose claim is missing", () => {
    expect(reading([{ file: "src/x.ts", message: "said something" }])).toThrow("is not a baseline file");
  });

  it("refuses an entry whose message is missing", () => {
    expect(reading([{ claim: "a-claim", file: "src/x.ts" }])).toThrow("is not a baseline file");
  });

  it("refuses an entry whose file is neither a string nor null", () => {
    expect(reading([{ claim: "a-claim", file: 7, message: "said something" }])).toThrow(
      "is not a baseline file",
    );
  });

  it("refuses a list where only one entry among several is malformed", () => {
    expect(reading([ENTRY, { claim: "b-claim" }, ENTRY])).toThrow("is not a baseline file");
  });
});
