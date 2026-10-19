import { defineConfig, devices } from "@playwright/test";

const port = 4322;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}/dev-digest-agentic-sdd-kit/`,
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx astro preview --port ${port} --ignore-lock`,
    url: `http://localhost:${port}/dev-digest-agentic-sdd-kit/`,
    reuseExistingServer: !process.env.CI,
  },
});
