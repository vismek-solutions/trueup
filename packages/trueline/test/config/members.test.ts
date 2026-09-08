import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runGuard } from "../../src/cli/guard.ts";
import { loadConfig, resolveInclude } from "../../src/config/load.ts";
import { assertReachable, type Member } from "../../src/config/members.ts";
import { check } from "../../src/compose.ts";
import type { Report } from "../../src/report/model.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { messagesIn } from "../support/report.ts";

const ROOT = fixtureAt("federated");
const CONFIG = join(ROOT, "trueline.config.ts");
const BOUNDARY = "every-import-respects-its-zone-boundary";

const loaded = () => loadConfig(CONFIG);

const reportOf = async (): Promise<Report> => {
  const { config, root, memberConfigs } = await loaded();
  const roots = resolveInclude(root, config.include);
  return check({ root, roots, ignoreFiles: [CONFIG, ...memberConfigs], ...config });
};

const breaches = async (): Promise<readonly string[]> => messagesIn(await reportOf(), BOUNDARY);

describe("a root that names members", () => {
  it("qualifies each member's zone with the member it came from", async () => {
    const { config } = await loaded();
    expect(config.zones.map((zone) => zone.name)).toEqual([
      "docs/pages",
      "lib/api",
      "lib/domain",
      "lib/engine",
      "ui/widgets",
    ]);
  });

  it("anchors a member's patterns at the member's own directory", async () => {
    const { config } = await loaded();
    const domain = config.zones.find((zone) => zone.name === "lib/domain");
    expect(domain?.patterns).toEqual(["packages/lib/src/domain/**"]);
  });

  it("needs no zones of its own", async () => {
    const { config } = await loaded();
    expect(config.zones.every((zone) => zone.name.includes("/"))).toBe(true);
  });

  it("reports every member's rulebook, so the guard can protect them all", async () => {
    const { memberConfigs } = await loaded();
    expect(memberConfigs.map((path) => path.slice(ROOT.length + 1))).toEqual([
      "apps/docs/trueline.config.ts",
      "packages/lib/trueline.config.ts",
      "packages/ui/trueline.config.ts",
    ]);
  });

  it("leaves the rulebooks themselves out of the analysis", async () => {
    expect(messagesIn(await reportOf(), "every-file-belongs-to-a-zone")).toEqual([]);
  });
});

describe("what one member may reach in another", () => {
  it("refuses a member nobody invited it into", async () => {
    expect(await breaches()).toContain(
      "is docs/pages and may not reach ui/widgets: widget from packages/ui/src/widget.ts",
    );
  });

  it("lets an invited member in through the api", async () => {
    expect((await breaches()).join(" ")).not.toContain("page.ts");
  });

  it("still refuses an invited member that reaches past the api", async () => {
    expect(await breaches()).toContain(
      "is docs/pages and may not reach lib/domain: thing from packages/lib/src/domain/thing.ts",
    );
  });

  it("lets the root forbid what a member granted itself", async () => {
    expect(await breaches()).toContain(
      "is lib/engine and may not reach ui/widgets: widget from packages/ui/src/widget.ts",
    );
  });
});

describe("naming a member that is not there", () => {
  const wanting = (name: string, allow: readonly string[]): Member => ({
    name,
    directory: `packages/${name}`,
    configPath: `packages/${name}/trueline.config.ts`,
    config: { zones: [], allow },
  });

  it("refuses a name no member declares, rather than reaching nothing in silence", () => {
    expect(() => assertReachable([wanting("lib", ["typo"])])).toThrow(/not a member/);
  });

  it("refuses a member that lists itself", () => {
    expect(() => assertReachable([wanting("lib", ["lib"])])).toThrow(/itself/);
  });
});

describe("what a member says about itself", () => {
  it("qualifies its own boundary on both sides", async () => {
    const { config } = await loaded();
    expect(config.boundaries?.[0]).toMatchObject({ from: "lib/domain", allow: ["lib/api"] });
  });

  it("is enforced like any other boundary", async () => {
    const { config, root, memberConfigs } = await loaded();
    const report = check({
      root,
      roots: resolveInclude(root, config.include),
      ignoreFiles: [CONFIG, ...memberConfigs],
      ...config,
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
    expect(await proposeTo("packages/lib/trueline.config.ts")).toContain(
      "no-edit-changes-the-rules-themselves",
    );
  });

  it("still refuses the root rulebook", async () => {
    expect(await proposeTo("trueline.config.ts")).toContain("no-edit-changes-the-rules-themselves");
  });
});
