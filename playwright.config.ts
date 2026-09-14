import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4184",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:site -- --port 4184",
    url: "http://127.0.0.1:4184",
    reuseExistingServer: false,
  },
});
