import { runGuard } from "../../src/cli/guard.ts";
import { fixtureAt } from "./fixtures.ts";

export const GUARDED = fixtureAt("guarded");
export const GUARDED_FOR_SERENA = fixtureAt("guarded-serena");

export const guardFor =
  (cwd: string) =>
  async (payload: unknown): Promise<{ code: number; output: string }> => {
    let output = "";
    const code = await runGuard({
      cwd,
      stdin: typeof payload === "string" ? payload : JSON.stringify(payload),
      write: (line) => (output += line),
    });
    return { code, output };
  };
