import { defineConfig } from "vitest/config";

// a spawned node process runs the real source, never stryker's instrumented copy, which node's
// type stripping refuses outright — so the mutation run cannot host these
const SPAWNED = ["test/**/*.spawned.test.ts"];

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/fixtures/**", ...(process.env.TRUEUP_MUTATION === undefined ? [] : SPAWNED)],
    testTimeout: 60_000,
  },
});
