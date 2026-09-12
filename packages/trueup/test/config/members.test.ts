import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runGuard } from "../../src/cli/guard.ts";
import { loadConfig, resolveInclude } from "../../src/config/load.ts";
import { memberDirectories } from "../../src/config/members.ts";
import { check } from "../../src/compose.ts";
import type { Report } from "../../src/report/model.ts";
import { fixtureAt } from "../support/fixtures.ts";
import { messagesIn } from "../support/report.ts";

const ROOT = fixtureAt("federated");
const CONFIG = join(ROOT, "trueup.config.ts");
const BOUNDARY = "every-import-respects-its-zone-boundary";

const loaded = () => loadConfig(CONFIG);

const reportOf = async (): Promise<Report> => {
  const { config, root, memberConfigs } = await loaded();
  const roots = resolveInclude(root, config.include);
  return await check({ root, roots, ignoreFiles: [CONFIG, ...memberConfigs], ...config });
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
      "apps/docs/trueup.config.ts",
      "packages/lib/trueup.config.ts",
      "packages/ui/trueup.config.ts",
    ]);
  });

  it("leaves the rulebooks themselves out of the analysis", async () => {
    expect(messagesIn(await reportOf(), "every-file-belongs-to-a-zone")).toEqual([]);
  });
});

describe("finding the directories a members pattern names", () => {
  const under = (patterns: readonly string[]): readonly string[] =>
    memberDirectories(ROOT, patterns).map((directory) => directory.slice(ROOT.length + 1));

  it("takes one directory per pattern match, from wherever in the tree they sit", () => {
    expect(under(["packages/*", "apps/*"])).toEqual(["apps/docs", "packages/lib", "packages/ui"]);
  });

  it("looks no deeper than the patterns reach, so a directory inside a member is never one", () => {
    expect(under(["packages/**"])).toEqual(["packages", "packages/lib", "packages/ui"]);
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
  const rulebookIn = (fixture: string): string => join(fixtureAt(fixture), "trueup.config.ts");

  it("refuses a name no member declares, rather than reaching nothing in silence", async () => {
    await expect(loadConfig(rulebookIn("unknown-member"))).rejects.toThrow(
      "packages/lib may reach typo, which is not a member",
    );
  });

  it("refuses a member that lists itself", async () => {
    await expect(loadConfig(rulebookIn("self-allowing-member"))).rejects.toThrow(
      "packages/lib lists itself in `allow`",
    );
  });
});

describe("what a member says about itself", () => {
  it("qualifies its own boundary on both sides", async () => {
    const { config } = await loaded();
    expect(config.boundaries?.[0]).toMatchObject({ from: "lib/domain", allow: ["lib/api"] });
  });

  it("judges only its own member's zones, so it cannot revoke a door another member opened", async () => {
    const { config } = await loaded();
    const internal = config.boundaries?.find((rule) => rule.from === "lib/domain");

    expect(internal?.governs).toEqual(["lib/api", "lib/domain", "lib/engine"]);
  });

  it("is enforced like any other boundary", async () => {
    const { config, root, memberConfigs } = await loaded();
    const report = await check({
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

describe("a root rule that names a member", () => {
  const boundariesOf = async (fixture: string) => {
    const { config } = await loadConfig(join(fixtureAt(fixture), "trueup.config.ts"));
    return config.boundaries ?? [];
  };

  const crossing = async () =>
    (await boundariesOf("member-boundary")).find(
      (rule) => rule.from === "web/pages" && rule.allow.includes("lib/api"),
    );

  it("anchors on the imported module, because a door is a re-exporter the declaring file walks past", async () => {
    expect((await crossing())?.anchor).toBe("imported-module");
  });

  it("opens the member's api and not the zones behind it", async () => {
    expect((await crossing())?.allow).toEqual(["web/pages", "lib/api"]);
  });

  it("leaves a rule between plain zones anchored on the declaring file", async () => {
    const plain = (await boundariesOf("member-boundary")).find((rule) => rule.from === "guide");

    expect(plain?.anchor).toBeUndefined();
  });

  it("refuses declaring-file anchoring on a member rule instead of never matching", async () => {
    const path = join(fixtureAt("anchored-member-boundary"), "trueup.config.ts");

    await expect(loadConfig(path)).rejects.toThrow(/no api zone can ever satisfy/);
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
    expect(await proposeTo("packages/lib/trueup.config.ts")).toContain(
      "no-edit-changes-the-rules-themselves",
    );
  });

  it("still refuses the root rulebook", async () => {
    expect(await proposeTo("trueup.config.ts")).toContain("no-edit-changes-the-rules-themselves");
  });
});
