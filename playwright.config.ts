import { defineConfig, devices } from "@playwright/test";

// End-to-end suite (e2e/*.spec.ts) against a production build:
//   pnpm e2e:fixtures && pnpm build && pnpm e2e
// Fixtures go in before the build: the sitemap and post pages are prerendered
// (ISR), so a post added after the build is missing until revalidation.
// The web server below runs `next start` on E2E_PORT (default 3100). It needs
// the same environment as the build (see the e2e job in .github/workflows/ci.yml).
// Base URL is localhost, not 127.0.0.1: browsers treat http://localhost as a
// secure context, so the Secure session and unlock cookies are kept.
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  outputDir: ".tmp-e2e/results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: process.env.CI ? [["github"], ["html", { outputFolder: ".tmp-e2e/report", open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Signs each role in once and saves the session for the specs that need it.
    { name: "setup", testMatch: /.*\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "chromium", dependencies: ["setup"], use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `node node_modules/next/dist/bin/next start -p ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
