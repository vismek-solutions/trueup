import { defineConfig } from "vitest/config";

// stryker's sandbox holds the package alone, and node's type stripping refuses its instrumented copy
const OUTSIDE_THE_SANDBOX = ["test/**/*.spawned.test.ts", "test/**/*.workspace.test.ts"];

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: [
      "test/fixtures/**",
      ...(process.env.TRUEUP_MUTATION === undefined ? [] : OUTSIDE_THE_SANDBOX),
    ],
    testTimeout: 60_000,
  },
});
