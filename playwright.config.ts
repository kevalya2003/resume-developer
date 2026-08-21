import { defineConfig, devices } from "@playwright/test";

/**
 * Overridable because Windows reserves shifting blocks of ports for Hyper-V and
 * WinNAT, and a reboot can move one over whatever is hardcoded here — which
 * surfaces as EACCES on a port nothing is listening on. Check with
 * `netsh interface ipv4 show excludedportrange protocol=tcp` and set E2E_PORT.
 */
const PORT = Number(process.env.E2E_PORT ?? 4321);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Built output, not the dev server: PDF rendering goes through a route
    // handler, and dev-mode compilation makes the first request time out.
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "pipe",
    env: {
      // The suite exports well over the production allowance in under a minute,
      // all from one address. Raised rather than disabled so the limiter is
      // still in the request path; the test that exercises it uses its own
      // forwarded-for address and drives past this larger ceiling itself.
      RESUME_RATE_CAPACITY: "60",
      RESUME_RATE_REFILL_PER_MINUTE: "60",
    },
  },
});
