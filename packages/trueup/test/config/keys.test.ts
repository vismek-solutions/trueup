import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, messageOf } from "../../src/config/load.ts";
import { fixtureAt } from "../support/fixtures.ts";

const rulebookIn = (fixture: string): string => join(fixtureAt(fixture), "trueup.config.ts");

const refusalFor = async (fixture: string): Promise<string> =>
  loadConfig(rulebookIn(fixture)).then(
    () => "",
    (failure: unknown) => messageOf(failure),
  );

const aboutMember = async (member: string): Promise<string> =>
  (await refusalFor("stray-key")).split("\n").find((line) => line.includes(`/${member}/`)) ?? "";

describe("a configuration key nothing reads", () => {
  it("loads a root configuration whose keys are all read", async () => {
    expect(await refusalFor("member-boundary")).toBe("");
  });

  it("loads a member configuration whose keys are all read", async () => {
    expect(await refusalFor("federated")).toBe("");
  });

  it("names a misspelled key, what is accepted, and what the silence would have cost", async () => {
    expect(await refusalFor("stray-root")).toBe(
      `${rulebookIn("stray-root")} sets \`boundries\`, \`allow\`,` +
        " which a root configuration does not read." +
        " `allow` belongs in the member configuration." +
        " A root configuration accepts `boundaries`, `changes`, `colocation`, `command`, `duplication`," +
        " `extensions`, `externals`, `ignoreDirectories`, `include`, `isolate`, `maxFilesPerDirectory`," +
        " `members`, `protect`, `readerships`, `reviewable`, `rules`, `runners`, `seams`," +
        " `testInternals`, `zones`." +
        " A key it does not read is ignored, so the run makes one fewer claim than you configured" +
        " and nothing says so.",
    );
  });

  it("says where a key belongs when it is a setting of the other kind", async () => {
    const said = await aboutMember("one");

    expect(said).toContain("sets `duplication`, which a member configuration does not read.");
    expect(said).toContain("`duplication` belongs in the root configuration.");
  });

  it("names every stray key in a file, not only the first", async () => {
    expect(await aboutMember("two")).toContain(
      "sets `duplication`, `boundries`, which a member configuration does not read.",
    );
  });

  it("leaves out where it belongs when the key belongs to neither", async () => {
    expect(await aboutMember("three")).not.toContain("belongs in the");
  });
});

describe("loading a configuration that sets a key nothing reads", () => {
  it("refuses the member config rather than dropping the claim it would have made", async () => {
    await expect(loadConfig(rulebookIn("stray-key"))).rejects.toThrow(
      /packages\/one\/trueup\.config\.ts sets `duplication`, which a member configuration does not read/,
    );
  });

  it("names every member it refused, so they are not fixed one run at a time", async () => {
    const refused = (await refusalFor("stray-key")).split("\n");

    expect(refused.map((line) => line.slice(fixtureAt("stray-key").length + 1, line.indexOf(" ")))).toEqual([
      "packages/one/trueup.config.ts",
      "packages/three/trueup.config.ts",
      "packages/two/trueup.config.ts",
    ]);
  });
});
