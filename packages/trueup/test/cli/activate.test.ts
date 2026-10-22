import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { runActivate } from "../../src/cli/activate/run.ts";

const ACTIVATED = fixtureAt("activated");
const MEMBERS = fixtureAt("member-isolate");
const UNGUARDED = fixtureAt("unguarded");

const capture = async (cwd: string, argv: readonly string[] = []): Promise<string> => {
  const lines: string[] = [];
  await runActivate({ cwd, argv, write: (line) => lines.push(line) });
  return lines.join("\n");
};

const ADVICE = [
  "<advice>",
  "- `trueup explain <file> <file>` — run this **before** creating or moving files, naming them all in",
  "  one call. It reports the zone each path falls into, which zones it may reach, and the",
  "  vocabulary it may not name.",
  "- `trueup explain --needs=<file>,<file>` — where a new file may live, given what it must import.",
  "  Add `--read-by=<file>` for what will import it. When no zone can hold it, it says what to split.",
  "- `trueup --dots` — check the whole project. Run it before calling a change done. It prints",
  "  one character per claim and explains only what failed.",
  "- `trueup --next` — the first problem to fix, with its remedy. `--next=<claim>` picks the claim.",
  "- `trueup docs <topic>` — the guide behind a claim, when its printed remedy is not enough.",
  "  Run it with no topic to list the pages; a claim name works as a topic.",
  "",
  "Every finding is printed with an explanation of what it means and how to resolve it. Read that",
  "explanation before changing anything.",
  "",
  "Fix the code, not the rule. Widening a boundary, adding a word to an allow list, or recording a",
  "violation in the baseline to make a check pass defeats the check. If a rule looks wrong, say so",
  "and leave it failing rather than editing it to be quiet.",
  "",
  "A correct fix often makes the count go up, because removing one violation exposes the ones",
  "standing behind it. Those problems were already there. Read the new findings and work through",
  "them rather than reverting a change that was right.",
  "</advice>",
];

const ZONE_SAID =
  "a file belongs to the first zone whose patterns match it; a role or a shared mark changes what is expected of it";
const ISOLATE_SAID = "directories matched by one pattern are siblings, and a sibling may not reach another";

describe("the block an agent reads at the start of a session", () => {
  it("gives every zone, rule and setting a project set", async () => {
    expect(await capture(ACTIVATED)).toBe(
      [
        "## Architecture",
        "",
        "<summary>6 files in 4 zones, and every rule below is enforced.</summary>",
        "",
        "<zones>",
        ZONE_SAID,
        "* engine, 2 files, src/engine/**, src/machinery/**",
        "* domain, 1 file, src/domain/** (api)",
        "* shared, 1 file, src/shared/**",
        "* ui, 1 file, src/ui/**",
        "and 1 file in no zone at all",
        "</zones>",
        "",
        "<boundaries>",
        "a zone may reach itself and what is listed here, and nothing else",
        '<reach from="engine">',
        "* shared",
        "* ui",
        "</reach>",
        '<reach from="domain">every other zone, since no rule constrains it</reach>',
        '<reach from="shared">every other zone, since no rule constrains it</reach>',
        '<reach from="ui">every other zone, since no rule constrains it</reach>',
        "</boundaries>",
        "",
        "<seams>",
        "generic code may not use the vocabulary its domains own",
        "* engine may not name what domain and ui owns, except warrant and table, literals from 6 characters",
        "* shared may not name what domain owns",
        "</seams>",
        "",
        "<isolate>",
        ISOLATE_SAID,
        "* src/*, except shared and ui",
        "* src/engine/*",
        "</isolate>",
        "",
        "<settings>",
        "<files-read>6</files-read>",
        "<extensions>",
        "* .ts",
        "* .mts",
        "</extensions>",
        "<externals>",
        "* virtual:*",
        "* remote:*",
        "</externals>",
        "<ignored-directories>",
        "* node_modules",
        "* dist",
        "</ignored-directories>",
        "<max-files-per-directory>4</max-files-per-directory>",
        "<duplication>declarations from 80 characters</duplication>",
        "<colocation>off</colocation>",
        "<rulebook>guarded, so an edit to it is ruled on</rulebook>",
        "<also-protected>",
        "* trueup.config.ts",
        "* .trueup-baseline.json",
        "</also-protected>",
        "<also-runs>",
        "* a-delegated-tool",
        "* another-delegated-tool",
        "</also-runs>",
        "<custom-rules>",
        "* a-named-custom-rule",
        "* another-custom-rule",
        "</custom-rules>",
        "</settings>",
        "",
        ...ADVICE,
      ].join("\n"),
    );
  });

  it("leaves out every section and setting a project never set", async () => {
    expect(await capture(UNGUARDED)).toBe(
      [
        "## Architecture",
        "",
        "<summary>2 files in 1 zone, and every rule below is enforced.</summary>",
        "",
        "<zones>",
        ZONE_SAID,
        "* all, 2 files, src/**, lib/**",
        "</zones>",
        "",
        "<settings>",
        "<files-read>2</files-read>",
        "<roots>",
        "* src",
        "* lib",
        "</roots>",
        "<rulebook>unguarded, so an agent may edit it and switch off any check it fails</rulebook>",
        "</settings>",
        "",
        ...ADVICE,
      ].join("\n"),
    );
  });

  it("gives a member's zones and rules under the member's directory", async () => {
    expect(await capture(MEMBERS)).toBe(
      [
        "## Architecture",
        "",
        "<summary>6 files in 2 zones, and every rule below is enforced.</summary>",
        "",
        "<zones>",
        ZONE_SAID,
        "* web/app, 5 files, apps/web/src/**",
        "* kit/widgets, 1 file, libs/kit/src/**",
        "</zones>",
        "",
        "<boundaries>",
        "a zone may reach itself and what is listed here, and nothing else",
        '<reach from="web/app">nothing</reach>',
        '<reach from="kit/widgets">nothing</reach>',
        "</boundaries>",
        "",
        "<isolate>",
        ISOLATE_SAID,
        "* apps/web/src/routes/*, except shared, and only apps/web/src/routes/index.ts may sit beside them",
        "</isolate>",
        "",
        "<directory-limits>",
        "* apps/web holds at most 2 files",
        "</directory-limits>",
        "",
        "<settings>",
        "<files-read>6</files-read>",
        "<members>",
        "* apps/*",
        "* libs/*",
        "</members>",
        "<colocation>on</colocation>",
        "<rulebook>guarded, so an edit to it is ruled on</rulebook>",
        "</settings>",
        "",
        ...ADVICE,
      ].join("\n"),
    );
  });

  it("says a bare review budget only warns, so the agent knows it will not be stopped", async () => {
    const said = await capture(fixtureAt("explained-budget"));

    expect(said).toContain("<reviewable>+90 / -40 against trunk, warns past it</reviewable>");
    expect(said).not.toContain("warning from");
  });

  it("gives each prose limit its number, since an agent cannot honour one it is not told", async () => {
    expect(await capture(fixtureAt("guarded-text"))).toContain(
      [
        "<prose>",
        "<reads>",
        "* docs/**/*.md",
        "</reads>",
        "<holds>",
        "* marks",
        "* words",
        "* 12 words a sentence",
        "* 2 sentences a paragraph",
        "* 3 words of inline code",
        "* link text",
        "* 20 words a section without an example",
        "</holds>",
        "</prose>",
      ].join("\n"),
    );
  });

  it("says when the comments in the code are read too, since that is where an agent writes most", async () => {
    expect(await capture(fixtureAt("guarded-comments"))).toContain(
      ["<reads>", "* docs/**/*.md", "* every comment", "</reads>"].join("\n"),
    );
  });

  it("marks a zone written to serve the layer above it, so a quiet component is explained", async () => {
    expect(await capture(fixtureAt("activated-switches"))).toContain("* lib, 1 file, src/lib/** (shared)");
  });

  it("names every switch a project turned on, and who may sit beside a sibling", async () => {
    expect(await capture(fixtureAt("activated-switches"))).toBe(
      [
        "## Architecture",
        "",
        "<summary>2 files in 2 zones, and every rule below is enforced.</summary>",
        "",
        "<zones>",
        ZONE_SAID,
        "* app, 1 file, src/app/**",
        "* lib, 1 file, src/lib/** (shared)",
        "</zones>",
        "",
        "<isolate>",
        ISOLATE_SAID,
        "* src/*, and nothing may sit beside them",
        "* src/app/*, and only src/app/index.ts and src/app/main.ts may sit beside them",
        "</isolate>",
        "",
        "<settings>",
        "<files-read>2</files-read>",
        "<reviewable>+600 / -400 against main, fails past it, warning from 80%</reviewable>",
        "<colocation>on</colocation>",
        "<readerships>on</readerships>",
        "<test-internals>on</test-internals>",
        "<rulebook>guarded, so an edit to it is ruled on</rulebook>",
        "</settings>",
        "",
        "<this-branch>+120 / -30 so far, 480 additions left</this-branch>",
        "",
        ...ADVICE,
      ].join("\n"),
    );
  });

  it("gives each shared directory that stands in an order its reach, under the rule", async () => {
    expect(await capture(fixtureAt("shared-layers"))).toContain(
      [
        "* src/routes/*, except _ui, _state and _root",
        "   * _state may reach nothing",
        "   * _root may reach _state",
      ].join("\n"),
    );
  });

  it("puts a package above its zones, so the path it owns is said once", async () => {
    expect(await capture(fixtureAt("grouped-zones"))).toContain(
      ['<package path="lib">', "* lib/read, 1 file, read/**", "* lib/write, 1 file, write/**", "</package>"].join("\n"),
    );
  });

  it("says a whole package once, rather than every zone in it", async () => {
    const said = await capture(fixtureAt("grouped-zones"));

    expect(said).toContain(['<reach from="app/pages">', "* lib/*", "</reach>"].join("\n"));
    expect(said).toContain("nothing else; a name ending in /* is every zone under it");
  });

  it("leaves the heading alone where no package stands whole", async () => {
    expect(await capture(MEMBERS)).toContain("and nothing else\n");
  });

  it("names what a wide reach leaves out, rather than listing most of the project", async () => {
    expect(await capture(fixtureAt("wide-reach"))).toContain(
      ['<reach-all-except from="a">', "* g", "</reach-all-except>"].join("\n"),
    );
  });

  it("keeps a short reach a list, even where naming what it leaves out would be shorter", async () => {
    expect(await capture(fixtureAt("wide-reach"))).toContain(
      ['<reach from="b">', "* c", "* d", "* e", "* f", "</reach>"].join("\n"),
    );
  });

  it("says nothing about the branch where no budget was set", async () => {
    expect(await capture(ACTIVATED)).not.toContain("this-branch");
  });

  it("says the branch was not measured rather than reading silence as room left", async () => {
    expect(await capture(fixtureAt("explained-budget"))).toContain("<this-branch>not measured, so nothing holds it:");
  });

  it("refuses an argument it does not know rather than ignoring it", async () => {
    const lines: string[] = [];
    const code = await runActivate({
      cwd: ACTIVATED,
      argv: ["--verbose"],
      write: (line) => lines.push(line),
    });

    expect(code).toBe(4);
    expect(lines).toEqual(["unrecognised: --verbose", "usage: trueup activate"]);
  });

  it("reports when there is no rulebook to describe", async () => {
    const lines: string[] = [];
    const code = await runActivate({ cwd: "/", argv: [], write: (line) => lines.push(line) });

    expect(code).toBe(3);
    expect(lines).toEqual(["no trueup.config.ts found"]);
  });

  it("reports a clean run, so a hook running it does not read as a failure", async () => {
    expect(await runActivate({ cwd: ACTIVATED, argv: [], write: () => undefined })).toBe(0);
  });
});
