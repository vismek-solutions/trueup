import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { findingsIn, messagesIn, reportForConfig } from "../support/report.ts";

const ROOT = fixtureAt("grants");
const CONFIG = join(ROOT, "trueup.config.ts");
const CLAIM = "every-grant-has-a-dependency";

const granted = async (): Promise<string> =>
  findingsIn(await reportForConfig(CONFIG), CLAIM)
    .map((finding) => `${relative(ROOT, finding.file ?? "")} ${finding.message}`)
    .join(" · ");

describe("comparing what a member may reach with what it depends on", () => {
  it("reports this and nothing besides, so a spurious finding is a failure too", async () => {
    expect(messagesIn(await reportForConfig(CONFIG), CLAIM)).toEqual([
      "allows ui, but package.json does not depend on @grants/ui",
    ]);
  });

  it("reports a grant onto a package the member does not depend on", async () => {
    expect(await granted()).toContain(
      "packages/web/trueup.config.ts allows ui, but package.json does not depend on @grants/ui",
    );
  });

  it("says nothing about a grant the dependency list backs", async () => {
    expect(await granted()).not.toContain("allows lib");
  });

  it("says nothing about a member with no package.json", async () => {
    expect(await granted()).not.toContain("loose");
  });

  it("says nothing about a member that depends on no package in the workspace", async () => {
    expect(await granted()).not.toContain("unwired");
  });

  it("says nothing at all about a monorepo whose members have no package.json", async () => {
    const report = await reportForConfig(join(fixtureAt("federated"), "trueup.config.ts"));

    expect(report.claims.map((claim) => claim.claim)).not.toContain(CLAIM);
  });
});
