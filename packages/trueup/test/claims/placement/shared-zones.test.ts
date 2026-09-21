import { describe, expect, it } from "vitest";
import { fixtureAt } from "../../support/fixtures.ts";
import { claimIn } from "../../support/report.ts";
import type { IsolationRule } from "../../../src/claims/isolation/siblings.ts";
import { check } from "../../../src/main.ts";
import type { Report } from "../../../src/report/model.ts";

const PLACEMENT = "no-value-is-declared-away-from-its-only-consumer";
const LAYERED = fixtureAt("layered");
const ISLANDS: readonly IsolationRule[] = [{ siblings: "src/routes/*" }];

const layeredReport = (shared: boolean, isolate: readonly IsolationRule[] = []): Promise<Report> =>
  check({
    root: LAYERED,
    colocation: true,
    isolate,
    zones: [
      { name: "components", patterns: ["src/components/**"], shared },
      { name: "routes", patterns: ["src/routes/**"] },
    ],
  });

const layered = async (shared: boolean, isolate: readonly IsolationRule[] = []): Promise<readonly string[]> =>
  claimIn(await layeredReport(shared, isolate), PLACEMENT)?.findings.map((finding) => finding.message) ?? [];

describe("a layer written to serve the layer above it", () => {
  it("reports every declaration while the zone has not said so", async () => {
    expect(await layered(false, ISLANDS)).toEqual([
      "declares renderBadge, used only by src/routes/home/page.ts",
      "declares renderButton, used only by routes (2 files)",
      "declares renderChip, used only by routes (2 files)",
      "declares renderLayout, used only by routes (3 files)",
      "declares 2 exports, all used only by routes (2 files), so the file is in the wrong directory rather than the declarations",
      "declares renderUserCard, used only by routes (2 files)",
    ]);
  });

  it("says nothing about a declaration two islands of the consumer read", async () => {
    expect((await layered(true, ISLANDS)).join()).not.toContain("renderButton");
    expect((await layered(true, ISLANDS)).join()).not.toContain("renderLayout");
  });

  it("names the island rather than the zone when every reader sits in one", async () => {
    expect(await layered(true, ISLANDS)).toContain(
      "declares renderUserCard, used only by src/routes/users (2 files)",
    );
  });

  it("names the file itself when the island holding the readers holds one", async () => {
    expect(await layered(true, ISLANDS)).toContain(
      "declares renderBadge, used only by src/routes/home/page.ts",
    );
  });

  it("calls the file misplaced when every export of it goes to one island", async () => {
    expect(await layered(true, ISLANDS)).toContain(
      "declares 2 exports, all used only by src/routes/users (2 files), so the file is in the wrong directory rather than the declarations",
    );
  });

  it("counts a file no rule groups as a part of its own, rather than lumping such files together", async () => {
    expect((await layered(true, ISLANDS)).join()).not.toContain("renderChip");
  });

  it("falls to counting files when no rule groups the readers", async () => {
    expect((await layered(true)).join()).not.toContain("renderUserCard");
    expect(await layered(true)).toContain("declares renderBadge, used only by src/routes/home/page.ts");
  });

  it("keeps a file's exports apart when they go to different parts, since no one move holds them", async () => {
    const about = (await layered(true)).filter((message) => message.includes("renderPair"));

    expect([...about].sort()).toEqual([
      "declares renderPairFoot, used only by src/routes/users/detail/row.ts",
      "declares renderPairHead, used only by src/routes/users/list/page.ts",
    ]);
  });

  it("tells the reader the consumer named is a part, so a second part would have closed it", async () => {
    expect(claimIn(await layeredReport(true, ISLANDS), PLACEMENT)?.guidance).toContain(
      "The consumer named is a directory or a file rather than a zone",
    );
  });

  it("leaves that branch out for a zone that never said it serves one layer", async () => {
    expect(claimIn(await layeredReport(false, ISLANDS), PLACEMENT)?.guidance).not.toContain(
      "The consumer named is a directory or a file rather than a zone",
    );
  });

  it("names declaring a zone shared as the move that hides a finding rather than fixing it", async () => {
    expect(claimIn(await layeredReport(false, ISLANDS), PLACEMENT)?.guidance).toContain(
      "That is honest only for a layer written to serve the layer above it",
    );
  });
});
