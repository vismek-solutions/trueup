import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { runActivate } from "../../src/cli/activate.ts";

const ACTIVATED = fixtureAt("activated");
const MEMBERS = fixtureAt("member-isolate");
const UNGUARDED = fixtureAt("unguarded");

const capture = async (cwd: string, argv: readonly string[] = []): Promise<string> => {
  const lines: string[] = [];
  await runActivate({ cwd, argv, write: (line) => lines.push(line) });
  return lines.join("\n");
};

const ADVICE = [
  "- `trueup explain <file>` — run this **before** creating or moving a file. It reports the zone that",
  "  path falls into, which zones it may and may not reach, and the vocabulary it may not name.",
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
];

const ZONE_HEADING =
  "zones — a file belongs to the first zone whose patterns match it; a role changes what is expected of it";

describe("the block an agent reads at the start of a session", () => {
  it("gives every zone, rule and setting a project set", async () => {
    expect(await capture(ACTIVATED)).toBe(
      [
        "## Architecture",
        "",
        "6 files in 4 zones, and every rule below is enforced.",
        "",
        ZONE_HEADING,
        "  engine    2 files  src/engine/** · src/machinery/**",
        "  domain     1 file  src/domain/**  (api)",
        "  shared     1 file  src/shared/**",
        "  ui         1 file  src/ui/**",
        "  and 1 file in no zone at all",
        "",
        "boundaries — a zone may reach itself and what is listed here, and nothing else",
        "  engine → shared · ui",
        "  domain → every other zone, since no rule constrains it",
        "  shared → every other zone, since no rule constrains it",
        "  ui     → every other zone, since no rule constrains it",
        "",
        "seams — generic code may not use the vocabulary its domains own",
        "  engine may not name what domain · ui owns, except warrant · table, literals from 6 characters",
        "  shared may not name what domain owns",
        "",
        "isolate — directories matched by one pattern are siblings, and a sibling may not reach another",
        "  src/*, except shared · ui",
        "  src/engine/*",
        "",
        "settings",
        "  files read                6",
        "  extensions                .ts · .mts",
        "  externals                 virtual:* · remote:*",
        "  ignored directories       node_modules · dist",
        "  max files per directory   4",
        "  duplication               declarations from 80 characters",
        "  colocation                off",
        "  rulebook                  guarded, so an edit to it is ruled on",
        "  also protected            trueup.config.ts · .trueup-baseline.json",
        "  also runs                 a-delegated-tool · another-delegated-tool",
        "  custom rules              a-named-custom-rule · another-custom-rule",
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
        "2 files in 1 zone, and every rule below is enforced.",
        "",
        ZONE_HEADING,
        "  all    2 files  src/** · lib/**",
        "",
        "settings",
        "  files read                2",
        "  roots                     src · lib",
        "  rulebook                  unguarded, so an agent may edit it and switch off any check it fails",
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
        "6 files in 2 zones, and every rule below is enforced.",
        "",
        ZONE_HEADING,
        "  web/app        5 files  apps/web/src/**",
        "  kit/widgets     1 file  libs/kit/src/**",
        "",
        "boundaries — a zone may reach itself and what is listed here, and nothing else",
        "  web/app     → nothing",
        "  kit/widgets → nothing",
        "",
        "isolate — directories matched by one pattern are siblings, and a sibling may not reach another",
        "  apps/web/src/routes/*, except shared, and only apps/web/src/routes/index.ts may sit beside them",
        "",
        "directory limits",
        "  apps/web holds at most 2 files",
        "",
        "settings",
        "  files read                6",
        "  members                   apps/* · libs/*",
        "  colocation                on",
        "  rulebook                  guarded, so an edit to it is ruled on",
        "",
        ...ADVICE,
      ].join("\n"),
    );
  });

  it("says a bare review budget only warns, so the agent knows it will not be stopped", async () => {
    const said = await capture(fixtureAt("explained-budget"));

    expect(said).toContain("  reviewable                +90 / -40 against trunk, warns past it");
    expect(said).not.toContain("warning from");
  });

  it("names every switch a project turned on, and who may sit beside a sibling", async () => {
    expect(await capture(fixtureAt("activated-switches"))).toBe(
      [
        "## Architecture",
        "",
        "2 files in 2 zones, and every rule below is enforced.",
        "",
        ZONE_HEADING,
        "  app     1 file  src/app/**",
        "  lib     1 file  src/lib/**",
        "",
        "isolate — directories matched by one pattern are siblings, and a sibling may not reach another",
        "  src/*, and nothing may sit beside them",
        "  src/app/*, and only src/app/index.ts · src/app/main.ts may sit beside them",
        "",
        "settings",
        "  files read                2",
        "  reviewable                +600 / -400 against main, fails past it, warning from 80%",
        "  colocation                on",
        "  readerships               on",
        "  test internals            on",
        "  rulebook                  guarded, so an edit to it is ruled on",
        "",
        "this branch",
        "  +120 / -30 so far, 480 additions left",
        "",
        ...ADVICE,
      ].join("\n"),
    );
  });

  it("gives each shared directory that stands in an order its reach, under the rule", async () => {
    expect(await capture(fixtureAt("shared-layers"))).toContain(
      [
        "  src/routes/*, except _ui · _state · _root",
        "    _state → nothing",
        "    _root  → _state",
      ].join("\n"),
    );
  });

  it("says a whole package once, rather than every zone in it", async () => {
    const said = await capture(fixtureAt("grouped-zones"));

    expect(said).toContain("  app/pages   → lib/*");
    expect(said).toContain("nothing else; a name ending in /* is every zone under it");
  });

  it("leaves the heading alone where no package stands whole", async () => {
    expect(await capture(MEMBERS)).toContain("and nothing else\n");
  });

  it("names what a wide reach leaves out, rather than listing most of the project", async () => {
    expect(await capture(fixtureAt("wide-reach"))).toContain("  a → every other zone except g");
  });

  it("keeps a short reach a list, even where naming what it leaves out would be shorter", async () => {
    expect(await capture(fixtureAt("wide-reach"))).toContain("  b → c · d · e · f");
  });

  it("says nothing about the branch where no budget was set", async () => {
    expect(await capture(ACTIVATED)).not.toContain("this branch");
  });

  it("says the branch was not measured rather than reading silence as room left", async () => {
    const said = await capture(fixtureAt("explained-budget"));

    expect(said).toContain("this branch");
    expect(said).toContain("  not measured, so nothing holds it:");
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
