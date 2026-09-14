import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
    launchOptions: { args: ["--no-sandbox"] },
  },
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NODE_ENV: "production",
      DB_DRIVER: "pglite",
      SEED_DEMO: "1",
      APP_URL: baseURL,
      NODE_OPTIONS: "--max-old-space-size=2048",
      RATE_LIMIT_MUTATION_MAX: "40",
      RATE_LIMIT_AUTH_MAX: "10",
      RATE_LIMIT_EXPORT_MAX: "5",
    },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
