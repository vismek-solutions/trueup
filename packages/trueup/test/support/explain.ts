import { runExplain } from "../../src/cli/explain/run.ts";
import { fixtureAt } from "./fixtures.ts";

export const EXPLAINED = fixtureAt("explained");
export const UNRULED = fixtureAt("ungoverned");
export const CUT = fixtureAt("cut");
export const CLAIMED = fixtureAt("claimed");

export const explainIn = async (
  cwd: string,
  argv: readonly string[],
): Promise<{ code: number; output: string }> => {
  let output = "";
  const code = await runExplain({ cwd, argv: [...argv], write: (line) => (output += `${line}\n`) });
  return { code, output };
};

export const saidBy = async (cwd: string, ...argv: string[]): Promise<string> =>
  (await explainIn(cwd, argv)).output;
