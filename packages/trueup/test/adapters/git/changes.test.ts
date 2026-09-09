import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { gitChanges } from "../../../src/adapters/git/changes.ts";
import type { FileChange } from "../../../src/ports/changes.ts";
import { fixtureAt } from "../../support/fixtures.ts";

const git = (root: string, ...args: string[]) => spawnSync("git", ["-C", root, ...args]);

const wrote = (root: string, file: string, text: string) => writeFileSync(join(root, file), text, "utf8");

let REPO = "";

const madeRepo = (): string => {
  const root = mkdtempSync(join(tmpdir(), "trueup-changes-"));
  git(root, "init", "-b", "main");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "test");
  git(root, "config", "commit.gpgsign", "false");

  wrote(root, "kept.ts", "one\ntwo\nthree\n");
  git(root, "add", "-A");
  git(root, "commit", "-m", "first");

  git(root, "checkout", "-b", "work");
  wrote(root, "kept.ts", "one\nTWO\nthree\n");
  wrote(root, "added.ts", "a\nb\n");
  git(root, "add", "-A");
  git(root, "commit", "-m", "second");

  wrote(root, "kept.ts", "one\nTWO\nthree\nfour\n");
  wrote(root, "fresh.ts", "x\ny\nz\n");
  return root;
};

const changedIn = (root: string, base = "main"): readonly FileChange[] => {
  const said = gitChanges().since(root, base);
  return said.kind === "measured" ? said.files : [];
};

const forFile = (root: string, file: string): FileChange | undefined =>
  changedIn(root).find((changed) => changed.file === file);

beforeAll(() => {
  REPO = madeRepo();
});

describe("measuring a branch against where it left the base", () => {
  it("counts a file the branch committed", () => {
    expect(forFile(REPO, "added.ts")).toEqual({ file: "added.ts", added: 2, removed: 0 });
  });

  it("counts work not committed yet, which is most of what an agent has done", () => {
    expect(forFile(REPO, "kept.ts")).toEqual({ file: "kept.ts", added: 2, removed: 1 });
  });

  it("counts a file git has never been told about, since a new file is the change", () => {
    expect(forFile(REPO, "fresh.ts")).toEqual({ file: "fresh.ts", added: 3, removed: 0 });
  });

  it("names the base it was given back, so the report can say what it compared", () => {
    const said = gitChanges().since(REPO, "main");

    expect(said.kind === "measured" && said.base).toBe("main");
  });

  it("leaves out a file that has not moved since the base", () => {
    expect(changedIn(REPO).map((changed) => changed.file)).not.toContain("untouched.ts");
  });

  it("reports those files and nothing else, so an empty name cannot ride along", () => {
    expect(changedIn(madeRepo())).toEqual([
      { file: "added.ts", added: 2, removed: 0 },
      { file: "kept.ts", added: 2, removed: 1 },
      { file: "fresh.ts", added: 3, removed: 0 },
    ]);
  });
});

describe("counting a file that is not text", () => {
  it("counts nothing for a file holding a zero byte, rather than a number off its bytes", () => {
    wrote(REPO, "binary.bin", "a\0b\0c");

    expect(forFile(REPO, "binary.bin")).toEqual({ file: "binary.bin", added: 0, removed: 0 });
  });

  it("counts a last line that carries no newline", () => {
    wrote(REPO, "nonewline.ts", "one\ntwo");

    expect(forFile(REPO, "nonewline.ts")?.added).toBe(2);
  });

  it("counts nothing for an empty file, which adds no line to read", () => {
    const root = madeRepo();
    wrote(root, "empty.ts", "");

    expect(forFile(root, "empty.ts")).toEqual({ file: "empty.ts", added: 0, removed: 0 });
  });

  it("counts nothing for a link pointing nowhere, rather than failing the measurement", () => {
    const root = madeRepo();
    symlinkSync(join(root, "no-such-target"), join(root, "dangling.ts"));

    expect(forFile(root, "dangling.ts")).toEqual({ file: "dangling.ts", added: 0, removed: 0 });
  });
});

describe("when there is nothing to measure against", () => {
  it("says which base it could not find, rather than reporting a change of no size", () => {
    const said = gitChanges().since(REPO, "no-such-branch");

    expect(said.kind).toBe("unmeasured");
    expect(said.kind === "unmeasured" && said.reason).toContain("no common commit with no-such-branch");
  });

  it("says so outside a repository, so a budget cannot look satisfied where git cannot answer", () => {
    const bare = mkdtempSync(join(tmpdir(), "trueup-nogit-"));
    const said = gitChanges().since(bare, "main");

    expect(said.kind).toBe("unmeasured");
  });

  it("says so where git cannot be run at all, not only where it answers badly", () => {
    const path = process.env.PATH;
    process.env.PATH = "";
    try {
      const said = gitChanges().since(REPO, "main");

      expect(said.kind === "unmeasured" && said.reason).toContain("ENOENT");
    } finally {
      process.env.PATH = path;
    }
  });

  it("repeats what git said about the diff, not only which base it was given", () => {
    const clone = join(mkdtempSync(join(tmpdir(), "trueup-bare-")), "clone.git");
    git(REPO, "clone", "--bare", REPO, clone);

    const said = gitChanges().since(clone, "main");

    expect(said.kind === "unmeasured" && said.reason).toMatch(
      /^could not read the change since main: \S/,
    );
  });

  it("says what git said about the diff where the excludes config it reads is unusable", () => {
    const root = madeRepo();
    mkdirSync(join(root, "excludes"));
    git(root, "config", "core.excludesFile", join(root, "excludes"));

    const said = gitChanges().since(root, "main");

    expect(said.kind === "unmeasured" && said.reason).toContain("could not read the change since main");
  });
});

describe("when git stops answering part way through", () => {
  const FAKE = join(fixtureAt("fake-tool"), "git.mjs");

  const asked = (mode: string) =>
    gitChanges(["node", FAKE, mode]).since(mkdtempSync(join(tmpdir(), "trueup-fake-")), "main");

  const DIFFED = [{ file: "kept.ts", added: 2, removed: 1 }];

  it("says so where git is killed reading the diff, rather than reporting a change of no size", () => {
    const said = asked("dies-on-diff");

    expect(said.kind === "unmeasured" && said.reason).toContain("killed before it finished");
  });

  it("keeps the diff it already has where git is killed listing untracked files", () => {
    const said = asked("dies-on-others");

    expect(said.kind === "measured" && said.files).toEqual(DIFFED);
  });

  it("leaves out what a refused listing printed, since that is a complaint and not a file", () => {
    const said = asked("prints-then-refuses");

    expect(said.kind === "measured" && said.files).toEqual(DIFFED);
  });
});
