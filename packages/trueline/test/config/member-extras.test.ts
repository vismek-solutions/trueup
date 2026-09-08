import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { check } from "../../src/compose.ts";
import { loadConfig, resolveInclude } from "../../src/config/load.ts";
import type { Report } from "../../src/report/model.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { messagesIn } from "../support/report.ts";

const ROOT = fixtureAt("federated-extras");
const CONFIG = join(ROOT, "trueline.config.ts");

const reportOf = async (): Promise<Report> => {
  const { config, root, memberConfigs } = await loadConfig(CONFIG);
  return check({
    root,
    roots: resolveInclude(root, config.include),
    ignoreFiles: [CONFIG, ...memberConfigs],
    ...config,
  });
};

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

describe("an internal boundary in a member", () => {
  it("does not judge an edge leaving the package, which its own zone names cannot describe", async () => {
    const breaches = messagesIn(await reportOf(), "every-import-respects-its-zone-boundary").join(" ");

    expect(breaches).not.toContain("core/engine");
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
