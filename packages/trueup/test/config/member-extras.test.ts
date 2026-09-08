import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { placementOf } from "../../src/compose.ts";
import { loadConfig } from "../../src/config/load.ts";
import type { Report } from "../../src/report/model.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { messagesIn, reportForConfig } from "../support/report.ts";

const ROOT = fixtureAt("federated-extras");
const CONFIG = join(ROOT, "trueup.config.ts");

const reportOf = (): Promise<Report> => reportForConfig(CONFIG);

describe("a rule a member declares", () => {
  it("is named after the member, so two packages can use the same rule name", async () => {
    const names = (await reportOf()).claims.map((claim) => claim.claim);

    expect(names).toContain("ui/one-declaration-per-file");
    expect(names).not.toContain("one-declaration-per-file");
  });

  it("sees its own zone names unqualified, so it never has to name its own package", async () => {
    expect(messagesIn(await reportOf(), "ui/sees-only-its-own-package")).toEqual(["zones model,view"]);
  });

  it("reports on its own files", async () => {
    expect(messagesIn(await reportOf(), "ui/one-declaration-per-file")).toEqual([
      "packages/ui/src/model/order.ts declares more than one thing",
      "packages/ui/src/view/chip.ts declares more than one thing",
    ]);
  });

  it("cannot see another package, so it cannot report on one", async () => {
    const found = messagesIn(await reportOf(), "ui/one-declaration-per-file").join(" ");

    expect(found).not.toContain("core");
  });
});

describe("the project a member's rule is handed", () => {
  const seen = async (prefix: string): Promise<string> =>
    messagesIn(await reportOf(), "ui/reports-what-the-scope-lets-it-see").find((message) =>
      message.startsWith(prefix),
    ) ?? "";

  it("answers filesIn with the member's own zone name, unqualified", async () => {
    expect(await seen("filesIn view:")).toBe(
      "filesIn view: packages/ui/src/view/badge.ts packages/ui/src/view/chip.ts packages/ui/src/view/reaches-model.ts",
    );
  });

  it("names a file's zone without the member prefix the rule never wrote", async () => {
    expect(await seen("zoneOf inside:")).toBe("zoneOf inside: model");
  });

  it("places a file outside the member in no zone, rather than in another package's", async () => {
    expect(await seen("zoneOf outside:")).toBe("zoneOf outside: null");
  });

  it("carries only edges leaving the member's own files, with their zones unqualified", async () => {
    expect(await seen("imports:")).toBe("imports: view>model view>null");
  });

  it("qualifies a zone the rule asks about, so a query in its own vocabulary matches", async () => {
    expect(await seen("imports from view:")).toBe(
      "imports from view: packages/ui/src/view/badge.ts packages/ui/src/view/reaches-model.ts",
    );
  });

  it("qualifies the other side of a query too, so asking what reaches a zone finds it", async () => {
    expect(await seen("imports into model:")).toBe(
      "imports into model: packages/ui/src/view/reaches-model.ts",
    );
  });

  it("qualifies a zone asked for a vocabulary, which is what a seam rule of its own would need", async () => {
    expect(await seen("names in model:")).toBe("names in model: Status statusLabel");
  });
});

describe("an internal boundary in a member", () => {
  it("does not judge an edge leaving the package, which its own zone names cannot describe", async () => {
    const breaches = messagesIn(await reportOf(), "every-import-respects-its-zone-boundary").join(" ");

    expect(breaches).not.toContain("core/engine");
  });

  it("leaves the invited member's door in what the file may reach, so explain agrees with the check", async () => {
    const { config, root } = await loadConfig(CONFIG);
    const placement = placementOf({
      root,
      path: join(ROOT, "packages/ui/src/view/badge.ts"),
      zones: config.zones,
      boundaries: config.boundaries ?? [],
    });

    expect(placement.mayReach).toContain("core/api");
    expect(placement.mayNotReach).toContain("core/engine");
  });

  it("still refuses what it forbids inside the package", async () => {
    expect(messagesIn(await reportOf(), "every-import-respects-its-zone-boundary")).toEqual([
      "is ui/view and may not reach ui/model: statusLabel from packages/ui/src/model/order.ts",
    ]);
  });
});

describe("a seam a member declares", () => {
  it("holds against that member's own zones", async () => {
    expect(messagesIn(await reportOf(), "generic-code-names-no-domain-concept")).toEqual([
      'is ui/view and names the value "awaiting_payment", which ui/model owns',
    ]);
  });
});

describe("a directory limit a member declares", () => {
  it("applies inside that member", async () => {
    expect(messagesIn(await reportOf(), "no-directory-holds-too-many-files")).toEqual([
      "holds 3 files, more than the 1 allowed",
    ]);
  });

  it("leaves a member that set no limit alone, rather than imposing its number", async () => {
    const report = await reportOf();
    const files = report.claims
      .find((claim) => claim.claim === "no-directory-holds-too-many-files")
      ?.findings.map((finding) => finding.file ?? "");

    expect(files?.every((file) => !file.includes("core"))).toBe(true);
  });
});
