import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["tests/live/**", ...defaultExclude],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**"],
      exclude: ["node_modules/**", "dist/**", "tests/**"],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 92,
      },
    },
  },
});
