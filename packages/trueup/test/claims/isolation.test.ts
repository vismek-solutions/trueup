import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureAt } from "../support/fixtures.ts";
import { claimIn, findingsIn, messagesIn, reportForConfig } from "../support/report.ts";
import type { IsolationRule } from "../../src/claims/isolation/siblings.ts";
import { check } from "../../src/compose.ts";
import type { Report } from "../../src/report/model.ts";

const ROOT = fixtureAt("routes");
const CLAIM = "no-sibling-directory-reaches-another";

const runWith = (...isolate: IsolationRule[]): Report =>
  check({
    root: ROOT,
    zones: [{ name: "app", patterns: ["src/**"] }],
    ...(isolate.length === 0 ? {} : { isolate }),
  });

describe("keeping sibling directories apart", () => {
  it("says nothing until a group is declared", () => {
    expect(runWith().claims.find((claim) => claim.claim === CLAIM)).toBeUndefined();
  });

  it("reports one sibling reaching another", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM)).toContain(
      "is a and may not reach sibling b: thing from src/routes/b/thing.ts",
    );
  });

  it("names the file that reached, not the one that was reached", () => {
    const findings = findingsIn(runWith({ siblings: "src/routes/*" }), CLAIM);
    const reaching = findings.find((finding) =>
      finding.message.startsWith("is a and may not reach sibling b"),
    );

    expect(reaching?.file).toBe(join(ROOT, "src/routes/a/page.ts"));
  });

  it("groups a file by its top directory however deep it sits", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM)).toContain(
      "is c and may not reach sibling b: thing from src/routes/b/thing.ts",
    );
  });

  it("warns rather than passing quietly when the pattern finds only one sibling", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/c/*" }), CLAIM)).toEqual([
      "`src/routes/c/*` matches only deep, so it is keeping nothing apart yet",
    ]);
  });

  it("keeps that a warning, since a second sibling may simply not exist yet", () => {
    const findings = findingsIn(runWith({ siblings: "src/routes/c/*" }), CLAIM);

    expect(findings.map((finding) => finding.severity)).toEqual(["warning"]);
  });

  it("warns the same way for a pattern reaching a level deeper than the tree goes", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*/*" }), CLAIM)).toEqual([
      "`src/routes/*/*` matches only c/deep, so it is keeping nothing apart yet",
    ]);
  });

  it("drops the warning once there are siblings to keep apart", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM).join()).not.toContain(
      "keeping nothing apart",
    );
  });

  it("fails loudly for a pattern with no wildcard, rather than making one group of everything", () => {
    expect(messagesIn(runWith({ siblings: "src/routes" }), CLAIM)).toEqual([
      "`src/routes` matches no directory, so nothing is being kept apart",
    ]);
  });

  it("names a group by its own directory when a globstar above it matched nothing", () => {
    expect(messagesIn(runWith({ siblings: "src/**/routes/*" }), CLAIM)).toEqual([
      "is _shared and may not reach sibling b: thing from src/routes/b/thing.ts",
      "is a and may not reach sibling .internal: hidden from src/routes/.internal/hidden.ts",
      "is a and may not reach sibling b: thing from src/routes/b/thing.ts",
      "is a and may not reach sibling _shared: util from src/routes/_shared/util.ts",
      "is c and may not reach sibling b: thing from src/routes/b/thing.ts",
    ]);
  });

  it("says nothing when a grouped file reaches one that belongs to no group", () => {
    const reached = messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM);

    expect(reached.some((message) => message.includes("root-util"))).toBe(false);
  });

  it("says nothing about an import it could not resolve to a file", () => {
    const reached = messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM);

    expect(reached.some((message) => message.includes("node:path"))).toBe(false);
  });

  it("reports these crossings and no others, so a lost or invented one is a failure", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM)).toEqual([
      "is _shared and may not reach sibling b: thing from src/routes/b/thing.ts",
      "is a and may not reach sibling .internal: hidden from src/routes/.internal/hidden.ts",
      "is a and may not reach sibling b: thing from src/routes/b/thing.ts",
      "is a and may not reach sibling _shared: util from src/routes/_shared/util.ts",
      "is c and may not reach sibling b: thing from src/routes/b/thing.ts",
    ]);
  });

  it("leaves a file at the parent ungrouped, so it is neither offender nor target", () => {
    const reached = messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM);

    expect(reached.some((message) => message.startsWith("is index.ts"))).toBe(false);
    expect(reached.some((message) => message.includes("routes/index.ts"))).toBe(false);
  });

  it("says nothing about a file reaching its own group, which is the whole point of a group", () => {
    const reached = messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM);

    expect(reached.some((message) => message.includes("helper"))).toBe(false);
  });

  it("keeps a dot-prefixed directory apart like any other, rather than overlooking it", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM)).toContain(
      "is a and may not reach sibling .internal: hidden from src/routes/.internal/hidden.ts",
    );
  });

  it("reports a crossing as an error, not a warning", () => {
    const severities = findingsIn(runWith({ siblings: "src/routes/*" }), CLAIM).map(
      (finding) => finding.severity,
    );

    expect(new Set(severities)).toEqual(new Set(["error"]));
  });

  it("fails as an error too when the pattern matches nothing", () => {
    expect(findingsIn(runWith({ siblings: "src/pages/*" }), CLAIM)[0]?.severity).toBe("error");
  });

  it("exempts a directory everyone is meant to share, as somewhere they may reach", () => {
    const shared = messagesIn(runWith({ siblings: "src/routes/*", except: ["_shared"] }), CLAIM);

    expect(shared).not.toContain(
      "is a and may not reach sibling _shared: util from src/routes/_shared/util.ts",
    );
    expect(messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM)).toContain(
      "is a and may not reach sibling _shared: util from src/routes/_shared/util.ts",
    );
  });

  it("still reports that directory reaching back into one of the islands", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*", except: ["_shared"] }), CLAIM)).toContain(
      "is _shared, which the group shares, and may not reach into sibling b: thing from src/routes/b/thing.ts",
    );
  });

  it("says why the exemption did not cover it, rather than repeating the sibling wording", () => {
    const said = messagesIn(runWith({ siblings: "src/routes/*", except: ["_shared"] }), CLAIM);

    expect(said.some((message) => message.includes("which the group shares"))).toBe(true);
  });

  it("takes a pattern, so a convention covers the directories following it and the ones added later", () => {
    const named = messagesIn(runWith({ siblings: "src/routes/*", except: ["_shared"] }), CLAIM);
    const convention = messagesIn(runWith({ siblings: "src/routes/*", except: ["_*"] }), CLAIM);

    expect(convention).toEqual(named);
  });

  it("lets a wildcard exemption reach a dot-prefixed directory, which it groups like any other", () => {
    const said = messagesIn(runWith({ siblings: "src/routes/*", except: ["*internal"] }), CLAIM);

    expect(said).not.toContain(
      "is a and may not reach sibling .internal: hidden from src/routes/.internal/hidden.ts",
    );
  });

  it("exempts nothing when the list is empty, rather than everything", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*", except: [] }), CLAIM)).toEqual(
      messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM),
    );
  });

  it("exempts nothing when the pattern matches no group, rather than everything", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*", except: ["nothing-here-*"] }), CLAIM)).toEqual(
      messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM),
    );
  });

  it("treats each combination of wildcards as its own island, and groups nothing shallower", () => {
    expect(messagesIn(runWith({ siblings: "src/*/*" }), CLAIM)).toEqual([
      "is routes/_shared and may not reach sibling routes/b: thing from src/routes/b/thing.ts",
      "is routes/a and may not reach sibling routes/.internal: hidden from src/routes/.internal/hidden.ts",
      "is routes/a and may not reach sibling routes/b: thing from src/routes/b/thing.ts",
      "is routes/a and may not reach sibling routes/_shared: util from src/routes/_shared/util.ts",
      "is routes/c and may not reach sibling routes/b: thing from src/routes/b/thing.ts",
    ]);
  });

  it("leaves out the directories a negated group names, and keeps the rest as islands", () => {
    expect(messagesIn(runWith({ siblings: "src/!(routes)/*" }), CLAIM)).toEqual([
      "`src/!(routes)/*` matches no directory, so nothing is being kept apart",
    ]);
    expect(messagesIn(runWith({ siblings: "src/!(pages)/*" }), CLAIM)).toEqual(
      messagesIn(runWith({ siblings: "src/*/*" }), CLAIM),
    );
  });

  it("keeps the same route name in two apps apart, and each app's routes from each other", () => {
    const root = fixtureAt("many-routes");
    const report = check({
      root,
      zones: [{ name: "apps", patterns: ["apps/**"] }],
      isolate: [{ siblings: "apps/*/src/routes/*" }],
    });

    expect(messagesIn(report, "every-import-resolves")).toEqual([]);
    expect(messagesIn(report, CLAIM)).toEqual([
      "is ui/a and may not reach sibling ui/b: thing from apps/ui/src/routes/b/thing.ts",
      "is web/a and may not reach sibling ui/a: page from apps/ui/src/routes/a/page.ts",
    ]);
  });

  it("fails rather than passing quietly when the pattern matches no directory", () => {
    expect(messagesIn(runWith({ siblings: "src/pages/*" }), CLAIM)).toEqual([
      "`src/pages/*` matches no directory, so nothing is being kept apart",
    ]);
  });

  it("takes the rule from the member that owns the shape, resolved against its directory", async () => {
    const report = await reportForConfig(join(fixtureAt("member-isolate"), "trueup.config.ts"));

    expect(messagesIn(report, CLAIM)).toEqual([
      "is a and may not reach sibling b: thing from apps/web/src/routes/b/thing.ts",
      "is shared, which the group shares, and may not reach into sibling b: thing from apps/web/src/routes/b/thing.ts",
    ]);
  });

  it("reads a member's `except` as the group names its own pattern captures", async () => {
    const report = await reportForConfig(join(fixtureAt("member-isolate"), "trueup.config.ts"));

    expect(messagesIn(report, CLAIM).join()).not.toContain("chrome");
  });

  it("tells the reader that widening the exception is not the fix", () => {
    const claim = runWith({ siblings: "src/routes/*" }).claims.find((entry) => entry.claim === CLAIM);
    expect(claim?.guidance).toContain("- Listing the reached-into sibling in `except`.");
  });
});

const LOOSE = "no-file-sits-loose-beside-a-group";

describe("a file sitting beside a group rather than in one", () => {
  it("says nothing until the rule says which files may sit there", () => {
    expect(claimIn(runWith({ siblings: "src/routes/*" }), LOOSE)).toBeUndefined();
  });

  it("reports every file at the parent when nothing is named as assembling the group", () => {
    const report = runWith({ siblings: "src/routes/*", wiring: [] });

    expect(findingsIn(report, LOOSE).map((finding) => finding.file)).toEqual([
      join(ROOT, "src/routes/.rc.ts"),
      join(ROOT, "src/routes/index.ts"),
      join(ROOT, "src/routes/root-util.ts"),
    ]);
  });

  it("reads a dot-named file sitting there like any other, rather than overlooking it", () => {
    const report = runWith({ siblings: "src/routes/*", wiring: ["**/index.ts"] });

    expect(findingsIn(report, LOOSE).map((finding) => finding.file)).toContain(
      join(ROOT, "src/routes/.rc.ts"),
    );
  });

  it("lets a wildcard in `wiring` cover that file too, as the same wildcard covers the rest", () => {
    expect(findingsIn(runWith({ siblings: "src/routes/*", wiring: ["**/*.ts"] }), LOOSE)).toEqual([]);
  });

  it("names the pattern whose parent it is sitting in, so the reader knows which rule spoke", () => {
    expect(messagesIn(runWith({ siblings: "src/routes/*", wiring: [] }), LOOSE)).toContain(
      "sits beside the siblings `src/routes/*` rather than in one of them",
    );
  });

  it("excuses the file that assembles the siblings, and only that one", () => {
    const report = runWith({ siblings: "src/routes/*", wiring: ["**/index.ts"] });

    expect(findingsIn(report, LOOSE).map((finding) => finding.file)).toEqual([
      join(ROOT, "src/routes/.rc.ts"),
      join(ROOT, "src/routes/root-util.ts"),
    ]);
  });

  it("takes a pattern, so the convention covers the files following it and the ones added later", () => {
    const named = messagesIn(runWith({ siblings: "src/routes/*", wiring: ["src/routes/index.ts"] }), LOOSE);
    const convention = messagesIn(runWith({ siblings: "src/routes/*", wiring: ["**/index.*"] }), LOOSE);

    expect(convention).toEqual(named);
  });

  it("says nothing about a file inside a sibling, which is where files are meant to be", () => {
    const report = runWith({ siblings: "src/routes/*", wiring: [] });

    expect(
      findingsIn(report, LOOSE)
        .map((finding) => finding.file)
        .join(),
    ).not.toContain("page.ts");
  });

  it("reads only the group's own parent, so a file a level above was never being kept apart", () => {
    const report = runWith({ siblings: "src/routes/*/*", wiring: [] });

    expect(
      findingsIn(report, LOOSE)
        .map((finding) => finding.file)
        .join(),
    ).not.toContain("routes/index.ts");
  });

  it("leaves a directory that holds no group alone, since its files sit beside no sibling", () => {
    const deeper = runWith({ siblings: "src/routes/*/*", wiring: [] });
    const reported = findingsIn(deeper, LOOSE).map((finding) => finding.file);

    expect(reported.join()).not.toContain("routes/a/");
    expect(reported.join()).not.toContain("routes/b/");
  });

  it("still reads the one directory that does hold a group, at that same depth", () => {
    const deeper = runWith({ siblings: "src/routes/*/*", wiring: [] });

    expect(findingsIn(deeper, LOOSE).map((finding) => finding.file)).toEqual([
      join(ROOT, "src/routes/c/loose.ts"),
    ]);
  });

  it("still reads a parent holding a single group, which the reaching claim only warns about", () => {
    const report = runWith({ siblings: "src/routes/c/*", wiring: [] });

    expect(findingsIn(report, LOOSE).map((finding) => finding.file)).toEqual([
      join(ROOT, "src/routes/c/loose.ts"),
    ]);
    expect(messagesIn(report, CLAIM)).toEqual([
      "`src/routes/c/*` matches only deep, so it is keeping nothing apart yet",
    ]);
  });

  it("reports a loose file as an error, not a warning", () => {
    const severities = findingsIn(runWith({ siblings: "src/routes/*", wiring: [] }), LOOSE);

    expect(new Set(severities.map((finding) => finding.severity))).toEqual(new Set(["error"]));
  });

  it("tells the reader that parking an undecided file in the list is not the fix", () => {
    const claim = claimIn(runWith({ siblings: "src/routes/*", wiring: [] }), LOOSE);

    expect(claim?.guidance).toContain("not for the one you would like to allow today");
  });

  it("reads a member's `wiring` against the member's own directory, as it does `siblings`", async () => {
    const report = await reportForConfig(join(fixtureAt("member-isolate"), "trueup.config.ts"));

    expect(findingsIn(report, LOOSE).map((finding) => finding.file)).toEqual([
      join(fixtureAt("member-isolate"), "apps/web/src/routes/stray.ts"),
    ]);
  });

  it("reads each parent against the groups under it, not against every group the rule matched", () => {
    const report = check({
      root: fixtureAt("many-routes"),
      zones: [{ name: "apps", patterns: ["apps/**"] }],
      isolate: [{ siblings: "apps/*/src/routes/*", wiring: [] }],
    });

    expect(findingsIn(report, LOOSE).map((finding) => finding.file)).toEqual([
      join(fixtureAt("many-routes"), "apps/web/src/routes/index.ts"),
    ]);
  });

  it("reads only the group that said which files may sit beside it, where another stays silent", () => {
    const report = runWith({ siblings: "src/routes/c/*", wiring: [] }, { siblings: "src/routes/*" });

    expect(findingsIn(report, LOOSE).map((finding) => finding.file)).toEqual([
      join(ROOT, "src/routes/c/loose.ts"),
    ]);
  });

  it("leaves the sibling-reaching claim alone, since a loose file breaches no boundary", () => {
    const loose = runWith({ siblings: "src/routes/*", wiring: [] });

    expect(messagesIn(loose, CLAIM)).toEqual(messagesIn(runWith({ siblings: "src/routes/*" }), CLAIM));
  });
});
