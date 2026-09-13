import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: "list",
  use: {
    baseURL: process.env["E2E_BASE_URL"] || "http://127.0.0.1:8100",
    channel: process.env["PLAYWRIGHT_CHANNEL"] || "chrome",
    ...devices["Desktop Chrome"],
    locale: "fr-BE",
    trace: "off",
    screenshot: "only-on-failure",
  },
});
