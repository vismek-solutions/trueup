import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runGuard } from "../../src/cli/guard.ts";
import { loadConfig, resolveInclude } from "../../src/config/load.ts";
import { check } from "../../src/compose.ts";
import type { Report } from "../../src/report/model.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { messagesIn } from "../support/report.ts";

const ROOT = fixtureAt("federated");
const CONFIG = join(ROOT, "architecture.config.ts");
const BOUNDARY = "every-import-respects-its-zone-boundary";

const loaded = () => loadConfig(CONFIG);

const reportOf = async (): Promise<Report> => {
  const { config, root, memberConfigs } = await loaded();
  const roots = resolveInclude(root, config.include);
  return check({ root, roots, ignoreFiles: [CONFIG, ...memberConfigs], ...config });
};

describe("a root that names members", () => {
  it("qualifies each member's zone with the member it came from", async () => {
    const { config } = await loaded();
    expect(config.zones.map((zone) => zone.name)).toEqual([
      "docs/pages",
      "lib/api",
      "lib/domain",
      "lib/engine",
    ]);
  });

  it("anchors a member's patterns at the member's own directory", async () => {
    const { config } = await loaded();
    const domain = config.zones.find((zone) => zone.name === "lib/domain");
    expect(domain?.patterns).toEqual(["packages/lib/src/domain/**"]);
  });

  it("keeps a member's role, so the api stays the way in", async () => {
    const { config } = await loaded();
    expect(config.zones.find((zone) => zone.name === "lib/api")?.role).toBe("api");
  });

  it("reports every member's rulebook, so the guard can protect them all", async () => {
    const { memberConfigs } = await loaded();
    expect(memberConfigs.map((path) => path.slice(ROOT.length + 1))).toEqual([
      "apps/docs/architecture.config.ts",
      "packages/lib/architecture.config.ts",
    ]);
  });
});

describe("protecting the rulebooks", () => {
  const proposeTo = async (path: string): Promise<string> => {
    let output = "";
    await runGuard({
      cwd: ROOT,
      stdin: JSON.stringify({
        tool_name: "Write",
        permission_mode: "acceptEdits",
        tool_input: { file_path: join(ROOT, path), content: "export default {}" },
      }),
      write: (line) => (output += line),
    });
    return output;
  };

  it("refuses an edit to a member's own rulebook, not only the root's", async () => {
    expect(await proposeTo("packages/lib/architecture.config.ts")).toContain(
      "no-edit-changes-the-rules-themselves",
    );
  });

  it("still refuses the root rulebook", async () => {
    expect(await proposeTo("architecture.config.ts")).toContain("no-edit-changes-the-rules-themselves");
  });
});

describe("boundaries across the two levels", () => {
  it("qualifies a member's own boundary on both sides", async () => {
    const { config } = await loaded();
    expect(config.boundaries?.[0]).toMatchObject({ from: "lib/domain", mayNotReach: ["lib/engine"] });
  });

  it("expands a member named at the root into its zones", async () => {
    const { config } = await loaded();
    const rule = config.boundaries?.find((entry) => entry.from === "docs/pages");
    expect(rule?.mayNotReach).toEqual(["lib/domain", "lib/engine"]);
  });

  it("leaves the api zone out, because that is what a role of api means", async () => {
    const { config } = await loaded();
    const rule = config.boundaries?.find((entry) => entry.from === "docs/pages");
    expect(rule?.mayNotReach).not.toContain("lib/api");
  });

  it("blocks the file that reaches past the member's index, and only that one", async () => {
    expect(messagesIn(await reportOf(), BOUNDARY)).toEqual([
      "is docs/pages and may not reach lib/domain: thing from packages/lib/src/domain/thing.ts",
    ]);
  });

  it("leaves the rulebooks themselves out of the analysis", async () => {
    expect(messagesIn(await reportOf(), "every-file-belongs-to-a-zone")).toEqual([]);
  });

  it("still enforces what a member says about itself", async () => {
    const { config, root } = await loaded();
    const zones = config.zones;
    const boundaries = config.boundaries ?? [];
    const report = check({
      root,
      roots: resolveInclude(root, config.include),
      zones,
      boundaries,
      overlay: new Map([
        [
          join(ROOT, "packages/lib/src/domain/thing.ts"),
          'import { run } from "../engine/run.ts";\n\nexport const thing = run();\n',
        ],
      ]),
    });
    expect(messagesIn(report, BOUNDARY)).toContain(
      "is lib/domain and may not reach lib/engine: run from packages/lib/src/engine/run.ts",
    );
  });
});
