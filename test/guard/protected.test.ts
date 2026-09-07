import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { protectionOf } from "../../src/guard/protected.ts";
import type { Protection } from "../../src/ports/protection.ts";

const ROOT = "/project";
const CONFIG = join(ROOT, "architecture.config.ts");
const BASELINE = join(ROOT, ".trueline-baseline.json");

const decide = (path: string, protect?: Protection) =>
  protectionOf({ root: ROOT, path: join(ROOT, path), always: [CONFIG, BASELINE], protect });

describe("deciding whether a file is the agent's to change", () => {
  it("leaves an ordinary source file alone", () => {
    expect(decide("src/thing.ts").verdict).toBe("allow");
  });

  it("covers the config and the baseline with nothing configured", () => {
    expect(decide("architecture.config.ts").verdict).toBe("ask");
    expect(decide(".trueline-baseline.json").verdict).toBe("ask");
  });

  it("asks by default, so setup and deliberate changes are still possible", () => {
    expect(decide("CLAUDE.md", ["CLAUDE.md"]).verdict).toBe("ask");
  });

  it("refuses outright when the project says to", () => {
    const strict: Protection = { paths: ["CLAUDE.md"], decision: "deny" };

    expect(decide("CLAUDE.md", strict).verdict).toBe("deny");
    expect(decide("architecture.config.ts", strict).verdict).toBe("deny");
  });

  it("hardens the built-in files without naming any others", () => {
    expect(decide("architecture.config.ts", { decision: "deny" }).verdict).toBe("deny");
    expect(decide("src/thing.ts", { decision: "deny" }).verdict).toBe("allow");
  });

  it("names the file relative to the project", () => {
    expect(decide(".github/workflows/ci.yml", [".github/**"]).reasons[0]).toContain(
      ".github/workflows/ci.yml",
    );
  });

  it("addresses the person when it asks, and the agent when it refuses", () => {
    expect(decide("architecture.config.ts").reasons[0]).toContain("An agent is asking");
    expect(decide("architecture.config.ts", { decision: "deny" }).reasons[0]).toContain("fix the code");
  });
});
