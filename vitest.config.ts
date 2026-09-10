import { defineConfig } from "vitest/config";
import path from "path";

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "medkit-sih26047-test-session-secret-min32chars";
process.env.NEXT_PUBLIC_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE || "true";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
