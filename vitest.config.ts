import { defineConfig } from "vitest/config";
import path from "path";

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "medkit-sih26047-test-session-secret-min32chars";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
