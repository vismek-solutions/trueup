import { describe, expect, it } from "vitest";
import { EXIT_BAD_USAGE, EXIT_NO_CONFIG } from "../../../src/cli/command.ts";
import { explainIn } from "../../support/explain.ts";
import { fixtureAt, nowhere } from "../../support/fixtures.ts";

const HOMES = fixtureAt("homes");

const explain = (...argv: string[]) => explainIn(HOMES, argv);

const DOMAIN = "--needs=src/domain/thing.ts";

describe("placing a file that does not exist yet", () => {
  it("names the one zone that may reach what it needs and be reached by what reads it", async () => {
    const { output } = await explain(DOMAIN, "--read-by=src/ui/screen.ts");

    expect(output).toBe(
      [
        "a new file",
        "",
        "reaches     domain",
        "read by     ui",
        "",
        "may live    api  src/api",
        "",
      ].join("\n"),
    );
  });

  it("offers every zone that may reach it while nothing reads it yet", async () => {
    const { output } = await explain(DOMAIN);

    expect(output).toBe(
      [
        "a new file",
        "",
        "reaches     domain",
        "read by     nothing yet",
        "",
        "may live    entry",
        "            api     src/api",
        "            store   src/store",
        "            domain  src/domain",
        "            mail",
        "",
      ].join("\n"),
    );
  });

  it("names a zone with no directory beside it rather than inventing one it cannot verify", async () => {
    const { output } = await explain(DOMAIN);

    expect(output).toContain("may live    entry\n");
    expect(output).toContain("            mail\n");
  });

  it("picks the shallowest directory a zone holds, not the first one discovery returns", async () => {
    expect((await explain(DOMAIN)).output).toContain("store   src/store\n");
  });

  it("exits clean, since a question about a file is not a finding", async () => {
    expect((await explain(DOMAIN)).code).toBe(0);
  });

  it("takes several needs from one flag, comma separated", async () => {
    expect((await explain("--needs=src/api/client.ts,src/store/db.ts")).output).toContain("reaches     api · store");
  });

  it("answers from the readers alone when nothing is named that it needs", async () => {
    const { output } = await explain("--read-by=src/ui/screen.ts");

    expect(output).toContain("reaches     none");
    expect(output).toContain("may live    ui   src/ui\n");
    expect(output).toContain("            api  src/api\n");
  });
});

describe("a file no zone can hold", () => {
  it("says so and offers a new zone when nothing would read back into what it reaches", async () => {
    const { output } = await explain("--needs=src/api/client.ts,src/store/db.ts");

    expect(output).toBe(
      [
        "a new file",
        "",
        "reaches     api · store",
        "read by     nothing yet",
        "",
        "may live    nowhere",
        "            No zone may reach api · store at once, and a zone that may would close no",
        "            cycle. Declare one, named for what it holds rather than for being shared.",
        "",
      ].join("\n"),
    );
  });

  it("refuses to offer a zone that would close a cycle, and says which reach closes it", async () => {
    const { output } = await explain("--needs=src/ui/screen.ts", "--read-by=src/domain/thing.ts");

    expect(output).toBe(
      [
        "a new file",
        "",
        "reaches     ui",
        "read by     domain",
        "",
        "may live    nowhere",
        "            A zone reaching ui and read by domain would close a cycle,",
        "            because ui already reaches domain. This is two files rather",
        "            than one: split it along the zones it reaches.",
        "",
      ].join("\n"),
    );
  });
});

describe("arguments the placement question cannot use", () => {
  it("names the path no zone covers rather than answering from the rest", async () => {
    const { code, output } = await explain("--needs=src/domain/thing.ts,src/nowhere/loose.ts");

    expect(code).toBe(EXIT_BAD_USAGE);
    expect(output).toContain("no zone covers src/nowhere/loose.ts");
    expect(output).toContain("Name a file this analysis reads");
  });

  it("refuses a path beside the flags, since the two ask different questions", async () => {
    const { code, output } = await explain("src/api/client.ts", DOMAIN);

    expect(code).toBe(EXIT_BAD_USAGE);
    expect(output).toContain("give one or the other");
  });

  it("still refuses a flag it does not know", async () => {
    expect((await explain("--needs-everything=x")).code).toBe(EXIT_BAD_USAGE);
  });

  it("says there is no rulebook instead of answering from nothing", async () => {
    const { code, output } = await nowhere((cwd) => explainIn(cwd, [DOMAIN]));

    expect(code).toBe(EXIT_NO_CONFIG);
    expect(output).toContain("no trueup.config.ts found");
  });
});
