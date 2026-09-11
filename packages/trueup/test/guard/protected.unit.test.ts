import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { protectionOf, rulebookGuarded } from "../../src/guard/protected.ts";
import type { Protection } from "../../src/ports/protection.ts";

const ROOT = "/project";
const CONFIG = join(ROOT, "trueup.config.ts");
const BASELINE = join(ROOT, ".trueup-baseline.json");

const decide = (path: string, protect?: Protection, mode = "default") =>
  protectionOf({ root: ROOT, path: join(ROOT, path), always: [CONFIG, BASELINE], protect, mode });

describe("deciding whether a file is the agent's to change", () => {
  it("leaves an ordinary source file alone", () => {
    expect(decide("src/thing.ts").verdict).toBe("allow");
  });

  it("covers the config and the baseline with nothing configured", () => {
    expect(decide("trueup.config.ts").verdict).toBe("ask");
    expect(decide(".trueup-baseline.json").verdict).toBe("ask");
  });

  it("asks by default, so setup and deliberate changes are still possible", () => {
    expect(decide("CLAUDE.md", ["CLAUDE.md"]).verdict).toBe("ask");
  });

  it("reads a rule that names paths and no decision the same as a bare list", () => {
    const unsaid: Protection = { paths: ["CLAUDE.md"] };

    expect(decide("CLAUDE.md", unsaid).verdict).toBe("ask");
    expect(decide("CLAUDE.md", unsaid, "acceptEdits").verdict).toBe("deny");
    expect(decide("src/thing.ts", unsaid).verdict).toBe("allow");
  });

  it("refuses outright when the project says to", () => {
    const strict: Protection = { paths: ["CLAUDE.md"], decision: "deny" };

    expect(decide("CLAUDE.md", strict).verdict).toBe("deny");
    expect(decide("trueup.config.ts", strict).verdict).toBe("deny");
  });

  it("hardens the built-in files without naming any others", () => {
    expect(decide("trueup.config.ts", { decision: "deny" }).verdict).toBe("deny");
    expect(decide("src/thing.ts", { decision: "deny" }).verdict).toBe("allow");
  });

  it("hands the rulebook over when the project asks it to, in every mode", () => {
    const open: Protection = { decision: "allow" };

    for (const mode of ["default", "plan", "acceptEdits", "bypassPermissions"]) {
      expect(decide("trueup.config.ts", open, mode).verdict).toBe("allow");
      expect(decide(".trueup-baseline.json", open, mode).verdict).toBe("allow");
    }
  });

  it("says nothing when it allows, since a hook that speaks on every write is noise", () => {
    expect(decide("trueup.config.ts", { decision: "allow" }).reasons).toEqual([]);
  });

  it("names the file relative to the project", () => {
    expect(decide(".github/workflows/ci.yml", [".github/**"]).reasons[0]).toContain(
      ".github/workflows/ci.yml",
    );
  });

  it("refuses instead of asking when the session will ask nobody", () => {
    for (const mode of ["acceptEdits", "auto", "dontAsk", "bypassPermissions"]) {
      expect(decide("trueup.config.ts", undefined, mode).verdict).toBe("deny");
    }
  });

  it("escalates an ask the project wrote out, since writing it changes nothing about who answers", () => {
    const asked: Protection = { decision: "ask" };

    expect(decide("trueup.config.ts", asked, "default").verdict).toBe("ask");
    expect(decide("trueup.config.ts", asked, "acceptEdits").verdict).toBe("deny");
  });

  it("still asks in the modes where a person is answering", () => {
    expect(decide("trueup.config.ts", undefined, "default").verdict).toBe("ask");
    expect(decide("trueup.config.ts", undefined, "plan").verdict).toBe("ask");
  });

  it("addresses the person when it asks, and the agent when it refuses", () => {
    expect(decide("trueup.config.ts").reasons[0]).toContain("An agent is asking");
    expect(decide("trueup.config.ts", { decision: "deny" }).reasons[0]).toContain("fix the code");
  });

  it("keeps every guidance line under the header, so a structured remedy stays nested", () => {
    for (const protect of [undefined, { decision: "deny" } as Protection]) {
      const [, ...body] = (decide("trueup.config.ts", protect).reasons[0] ?? "").split("\n");

      expect(body.every((line) => line === "" || line.startsWith("  "))).toBe(true);
      expect(body).toContain("");
    }
  });
});

describe("telling the report whether the rulebook is guarded", () => {
  it("counts an unset, a list and a hardened rule as guarded", () => {
    expect(rulebookGuarded(undefined)).toBe(true);
    expect(rulebookGuarded(["CLAUDE.md"])).toBe(true);
    expect(rulebookGuarded({ decision: "deny" })).toBe(true);
    expect(rulebookGuarded({ paths: ["CLAUDE.md"] })).toBe(true);
  });

  it("counts an allowance as unguarded, so the report can say so", () => {
    expect(rulebookGuarded({ decision: "allow" })).toBe(false);
  });
});
