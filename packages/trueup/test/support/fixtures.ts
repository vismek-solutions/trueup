import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURES = fileURLToPath(new URL("../fixtures", import.meta.url));

export const fixtureAt = (name: string): string => join(FIXTURES, name);

export const copyOfFixture = (name: string): string => {
  const directory = mkdtempSync(join(FIXTURES, `${name}-run-`));
  cpSync(fixtureAt(name), directory, { recursive: true });
  return directory;
};

export const discard = (directory: string): void => rmSync(directory, { recursive: true, force: true });

export const nowhere = async <T>(run: (cwd: string) => Promise<T>): Promise<T> => {
  const empty = mkdtempSync(join(tmpdir(), "trueup-"));
  try {
    return await run(empty);
  } finally {
    discard(empty);
  }
};
