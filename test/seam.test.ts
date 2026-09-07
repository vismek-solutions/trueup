import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SeamRule } from "../src/claims/seam.ts";
import { check } from "../src/compose.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "seam");

const ZONES = [
  { name: "domain", patterns: ["domain/**"] },
  { name: "engine", patterns: ["engine/**"] },
];

const leaks = (rule: SeamRule): string[] => {
  const report = check({ root: ROOT, zones: ZONES, seams: [rule] });
  const findings =
    report.claims.find((claim) => claim.claim === "generic-code-names-no-domain-concept")?.findings ?? [];
  return findings.map((finding) => `${relative(ROOT, finding.file ?? "")} ${finding.message.split("names ")[1]}`).sort();
};

const ENGINE_VS_DOMAIN: SeamRule = { generic: "engine", domain: ["domain"] };

describe("generic code naming a domain concept", () => {
  it("catches a domain value hardcoded where no import explains it", () => {
    expect(leaks(ENGINE_VS_DOMAIN)).toContain('engine/table.ts the value "testimony", which domain owns');
  });

  it("catches a generic file declaring a shape under a name the domain owns", () => {
    expect(leaks(ENGINE_VS_DOMAIN)).toContain("engine/mirror.ts the name Warrant, which domain owns");
  });

  it("says nothing about a file that imports the domain name outright", () => {
    expect(leaks(ENGINE_VS_DOMAIN).join()).not.toContain("legit.ts");
  });

  it("says nothing about generic code that names no domain concept", () => {
    expect(leaks(ENGINE_VS_DOMAIN).join()).not.toContain("clean.ts");
  });

  it("finds exactly those two leaks and no others", () => {
    expect(leaks(ENGINE_VS_DOMAIN)).toHaveLength(2);
  });

  it("reports a leaking name once per file however often it is mentioned", () => {
    const report = check({ root: ROOT, zones: ZONES, seams: [ENGINE_VS_DOMAIN] });
    const findings =
      report.claims.find((claim) => claim.claim === "generic-code-names-no-domain-concept")?.findings ?? [];
    const mirror = findings.filter((finding) => (finding.file ?? "").endsWith("mirror.ts"));
    expect(mirror).toHaveLength(1);
  });

  it("honours an explicit allowance", () => {
    expect(leaks({ ...ENGINE_VS_DOMAIN, allow: ["testimony", "Warrant"] })).toEqual([]);
  });

  it("ignores short values so incidental strings do not fire", () => {
    expect(leaks({ ...ENGINE_VS_DOMAIN, minLiteralLength: 99 })).toEqual([
      "engine/mirror.ts the name Warrant, which domain owns",
    ]);
  });
});
