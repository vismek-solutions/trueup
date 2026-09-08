import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/load.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { messagesFor, reportForConfig } from "../support/report.ts";

const ROOT = fixtureAt("doors");
const CONFIG = join(ROOT, "trueup.config.ts");
const CLAIM = "every-api-zone-is-exported";

const reported = (): Promise<string> => messagesFor(CONFIG, CLAIM);

describe("comparing the api zones with what package.json publishes", () => {
  it("reports a subpath no api zone covers, which refuses imports that resolve", async () => {
    expect(await reported()).toContain("exports ./vet, which no api zone covers");
  });

  it("reports a door nothing publishes, which no consumer outside the workspace can use", async () => {
    expect(await reported()).toContain("zone drifted/spare is a door that package.json does not export");
  });

  it("says nothing about a package whose exports point at build output", async () => {
    expect(await reported()).not.toContain("built");
  });

  it("says nothing about a wildcard subpath, which it cannot match to one zone", async () => {
    expect(await reported()).not.toContain("globbed");
  });

  it("says nothing at all about a monorepo whose members have no package.json", async () => {
    const report = await reportForConfig(join(fixtureAt("federated"), "trueup.config.ts"));

    expect(report.claims.map((claim) => claim.claim)).not.toContain(CLAIM);
  });
});

describe("deriving the doors from package.json", () => {
  it("puts every exported source file in the member's api zone", async () => {
    const { config } = await loadConfig(CONFIG);
    const door = config.zones.find((zone) => zone.name === "derived/api");

    expect(door?.role).toBe("api");
    expect(door?.patterns).toEqual(["packages/derived/src/index.ts", "packages/derived/src/vet/index.ts"]);
  });

  it("leaves the rest of the package behind the door", async () => {
    const report = await reportForConfig(CONFIG);

    expect(report.coverage.filesByZone["derived/api"]).toBe(2);
    expect(report.coverage.filesByZone["derived/inside"]).toBe(1);
  });

  it("has nothing to report, because the two lists became one", async () => {
    expect(await reported()).not.toContain("derived");
  });

  it("refuses a member that both derives its doors and declares one", async () => {
    await expect(loadConfig(join(fixtureAt("doors-conflict"), "trueup.config.ts"))).rejects.toThrow(
      /also declares an api zone/,
    );
  });
});
