import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/main.ts";

const RULEBOOK = `export default {
  include: ["src"],
  zones: [{ name: "app", patterns: ["src/**"] }],
  reviewable: { additions: 10, deletions: 10, except: ["**/*.lock"] },
};
`;

const declarations = (count: number, name: string): string =>
  `${Array.from({ length: count }, (_, at) => `export const ${name}${at} = ${at};`).join("\n")}\n`;

let PROJECT = "";

beforeAll(() => {
  PROJECT = mkdtempSync(join(tmpdir(), "trueup-review-"));
  const git = (...args: string[]) => spawnSync("git", ["-C", PROJECT, ...args]);
  const wrote = (file: string, text: string) => writeFileSync(join(PROJECT, file), text, "utf8");

  mkdirSync(join(PROJECT, "src"));
  wrote("trueup.config.ts", RULEBOOK);
  wrote("src/one.ts", "export const one = 1;\n");
  git("init", "-b", "main");
  git("config", "user.email", "a@b.c");
  git("config", "user.name", "t");
  git("add", "-A");
  git("commit", "-m", "first");
  git("checkout", "-b", "work");

  wrote("src/big.ts", declarations(40, "big"));
  wrote("deps.lock", declarations(900, "lock"));
});

const reportOf = async (argv: readonly string[] = []): Promise<string> => {
  let output = "";
  await runCli({ cwd: PROJECT, argv: [...argv], write: (line) => (output += `${line}\n`) });
  return output;
};

describe("a project that set a review budget", () => {
  it("reads the budget out of the rulebook, so the claim runs at all", async () => {
    expect(await reportOf()).toContain("no-change-outgrows-its-review");
  });

  it("measures the branch against where it left the base", async () => {
    expect(await reportOf()).toContain("+40 / -0 against main");
  });

  it("leaves out a file the budget excepted, which git still reports", async () => {
    const said = await reportOf();

    expect(said).toContain("heaviest: src/big.ts +40/-0");
    expect(said).not.toContain("deps.lock");
  });

  it("keeps the run clean, since a budget warning is not a failure", async () => {
    expect(await reportOf()).toContain("0 errors · 1 warning");
  });
});
