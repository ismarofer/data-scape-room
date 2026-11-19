import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    poolOptions: { forks: { execArgv: ["--max-old-space-size=4096"] } },
    testTimeout: 60_000,
  },
});
