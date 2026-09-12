import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { verdictFrom } from "../support/guard.ts";

const verdictOn = verdictFrom(fixtureAt("guarded-content"));

const WORN = 'export const className = "stray-class";\n';
const PLAIN = 'export const className = "plain";\n';

describe("a rule that reads the text of a file", () => {
  it("refuses a write that introduces what the rule forbids", async () => {
    expect(await verdictOn("src/clean.ts", WORN)).toBe("deny");
  });

  it("allows the write that takes it back out, rather than judging the saved file", async () => {
    expect(await verdictOn("src/worn.ts", PLAIN)).toBe("allowed");
  });

  it("still refuses a write that leaves it in place", async () => {
    expect(await verdictOn("src/worn.ts", WORN)).toBe("deny");
  });
});
