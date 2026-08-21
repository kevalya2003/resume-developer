import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    // Playwright owns tests/e2e; including it here would make vitest try to run
    // specs written against a completely different runner.
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "node",
    globals: true,
  },
});
