import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/load.ts";
import type { ResolvedConfig } from "../../src/config/model.ts";
import { fixtureAt } from "../support/fixtures.ts";

const ROOT = fixtureAt("federated-manifests");

const configured = async (): Promise<ResolvedConfig> => (await loadConfig(join(ROOT, "trueup.config.ts"))).config;

const at = (member: string, file: string): string => join(ROOT, "packages", member, file);

describe("members beside a directory the pattern does not name", () => {
  it("takes only the directories the patterns named, at whatever depth they sit", async () => {
    const zones = (await configured()).zones ?? [];

    expect(zones.map((zone) => zone.name)).toEqual([
      "web/src",
      "keeps-app/src",
      "keeps-core/api",
      "keeps-core/engine",
      "keeps-nameless/src",
      "keeps-plain/src",
      "keeps-tools/api",
      "tooling",
    ]);
  });
});

describe("a rule a member states about its own tree", () => {
  it("reads the sibling pattern as sitting under the member, and names no wiring it was not given", async () => {
    expect((await configured()).isolate).toEqual([
      { siblings: "packages/keeps-core/src/engine/*" },
    ]);
  });
});

describe("what a member is allowed to depend on", () => {
  const grants = async () => (await configured()).grants ?? [];

  it("reports the grant beside the dependency it stands on", async () => {
    expect(await grants()).toEqual([
      {
        configPath: at("keeps-app", "trueup.config.ts"),
        dependsOn: ["@acme/core"],
        grants: [{ member: "keeps-core", dependency: "@acme/core" }],
      },
    ]);
  });

  it("keeps only the dependencies another member publishes, not every package named", async () => {
    expect((await grants())[0]?.dependsOn).not.toContain("left-pad");
  });

  it("says nothing about a member that allows nobody", async () => {
    expect((await grants()).map((entry) => entry.configPath)).not.toContain(
      at("keeps-core", "trueup.config.ts"),
    );
  });
});

describe("the surface a member publishes", () => {
  const surfaces = async () => (await configured()).apiSurfaces ?? [];

  it("names the manifest the doors are checked against", async () => {
    expect((await surfaces()).map((surface) => surface.manifest)).toEqual([
      at("keeps-core", "package.json"),
      at("keeps-tools", "package.json"),
    ]);
  });

  it("takes the door from the zone declared as one", async () => {
    expect((await surfaces())[0]?.doors).toEqual(["keeps-core/api"]);
  });

  it("checks a member that turned the derived doors off, since it named its own", async () => {
    expect((await surfaces())[1]?.doors).toEqual(["keeps-tools/api"]);
  });

  it("says nothing about a member that publishes files but declares no door", async () => {
    expect((await surfaces()).map((surface) => surface.manifest)).not.toContain(
      at("keeps-app", "package.json"),
    );
  });
});

describe("what one member may reach in another it allows", () => {
  const allowedFrom = async (zone: string): Promise<readonly (readonly string[])[]> =>
    ((await configured()).boundaries ?? [])
      .filter((entry) => entry.from === zone)
      .map((entry) => [...entry.allow]);

  it("opens the door of a member that declared one, and nothing behind it", async () => {
    expect((await allowedFrom("keeps-app/src"))[0]).toEqual([
      "keeps-app/src",
      "keeps-core/api",
      "keeps-nameless/src",
      "keeps-plain/src",
    ]);
  });

  it("opens nothing at all in a member nobody allowed", async () => {
    expect(await allowedFrom("keeps-tools/api")).toEqual([["keeps-tools/api"]]);
  });
});

describe("a root rule naming a member on one side only", () => {
  const rulesFrom = async (zone: string) =>
    ((await configured()).boundaries ?? []).filter((entry) => entry.from === zone);

  it("keeps a plain zone on the allowed side under the name it already had", async () => {
    expect((await rulesFrom("keeps-core/engine")).at(-1)?.allow).toEqual([
      "keeps-core/api",
      "keeps-core/engine",
      "tooling",
    ]);
  });

  it("adds nothing of the member's own when the rule comes from a plain zone", async () => {
    expect((await rulesFrom("tooling"))[0]?.allow).toEqual(["keeps-core/api"]);
  });

  it("anchors on the imported module, since one side is a member", async () => {
    expect((await rulesFrom("tooling"))[0]?.anchor).toBe("imported-module");
  });
});
