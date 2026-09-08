import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { disagreements } from "../support/agreement.ts";
import { fixtureAt } from "../support/fixtures.ts";

const EXTRAS = join(fixtureAt("federated-extras"), "trueup.config.ts");
const FEDERATED = join(fixtureAt("federated"), "trueup.config.ts");

describe("what the check accepts, explain says the file may reach", () => {
  it("holds across a monorepo whose members carry internal boundaries", async () => {
    const { judged, found } = await disagreements({ configPath: EXTRAS });

    expect(found).toEqual([]);
    expect(judged).toBeGreaterThan(0);
  });

  it("holds across a monorepo whose root narrows what a member granted itself", async () => {
    const { judged, found } = await disagreements({ configPath: FEDERATED });

    expect(found).toEqual([]);
    expect(judged).toBeGreaterThan(0);
  });

  it("catches a placement answer that drops a zone the check accepts", async () => {
    const { found } = await disagreements({ configPath: EXTRAS, breakZone: "core/api" });

    expect(found.length).toBeGreaterThan(0);
  });

  it("skips only what it cannot zone, so the sweep cannot pass by excluding its subject", async () => {
    const { judged, unzoned } = await disagreements({ configPath: EXTRAS });

    expect(unzoned).toBe(0);
    expect(judged).toBeGreaterThan(0);
  });
});
