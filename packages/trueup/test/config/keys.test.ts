import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { strayKeysIn } from "../../src/config/keys.ts";
import { loadConfig } from "../../src/config/load.ts";
import { fixtureAt } from "../support/fixtures.ts";

const ZONES = [{ name: "app", patterns: ["src/**"] }];

describe("a configuration key nothing reads", () => {
  it("says nothing about a root configuration whose keys are all read", () => {
    expect(strayKeysIn({ zones: ZONES, colocation: true, runners: [] }, "root")).toBeNull();
  });

  it("says nothing about a member configuration whose keys are all read", () => {
    expect(strayKeysIn({ zones: ZONES, allow: ["lib"], doorsFromExports: true }, "member")).toBeNull();
  });

  it("names a misspelled key, what is accepted, and what the silence would have cost", () => {
    expect(strayKeysIn({ zones: ZONES, boundries: [] }, "root")).toBe(
      "sets `boundries`, which a root configuration does not read." +
        " A root configuration accepts `boundaries`, `colocation`, `command`, `duplication`," +
        " `extensions`, `externals`, `ignoreDirectories`, `include`, `isolate`, `maxFilesPerDirectory`," +
        " `members`, `protect`, `rules`, `runners`, `seams`, `zones`." +
        " A key it does not read is ignored, so the run makes one fewer claim than you configured" +
        " and nothing says so.",
    );
  });

  it("says where a key belongs when it is a setting of the other kind", () => {
    const said = strayKeysIn({ zones: ZONES, isolate: [] }, "member") ?? "";

    expect(said).toContain("sets `isolate`, which a member configuration does not read.");
    expect(said).toContain("`isolate` belongs in the root configuration.");
  });

  it("says the same in the other direction, for a member setting written at the root", () => {
    const said = strayKeysIn({ zones: ZONES, allow: [] }, "root") ?? "";

    expect(said).toContain("`allow` belongs in the member configuration.");
  });

  it("names every stray key, not only the first", () => {
    const said = strayKeysIn({ zones: ZONES, isolate: [], boundries: [] }, "member") ?? "";

    expect(said).toContain("sets `isolate`, `boundries`, which a member configuration does not read.");
    expect(said).toContain("`isolate` belongs in the root configuration.");
  });

  it("offers no relocation for a key that belongs to neither kind", () => {
    expect(strayKeysIn({ zones: ZONES, boundries: [] }, "member") ?? "").not.toContain("belongs in the");
  });
});

describe("loading a configuration that sets a key nothing reads", () => {
  it("refuses the member config rather than dropping the claim it would have made", async () => {
    const path = join(fixtureAt("stray-key"), "trueup.config.ts");

    await expect(loadConfig(path)).rejects.toThrow(
      /packages\/one\/trueup\.config\.ts sets `isolate`, which a member configuration does not read/,
    );
  });
});
