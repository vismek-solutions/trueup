import { join } from "node:path";
import { runGuard } from "../../src/cli/guard.ts";
import { fixtureAt } from "./fixtures.ts";

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

export const verdictFrom =
  (cwd: string) =>
  async (file: string, content: string): Promise<string> => {
    const { output } = await guardFor(cwd)({
      tool_name: "Write",
      tool_input: { file_path: join(cwd, file), content },
    });
    return output === "" ? "allowed" : JSON.parse(output).hookSpecificOutput.permissionDecision;
  };
