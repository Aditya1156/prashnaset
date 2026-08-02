import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Share .env.local (Supabase URL + key) with the specs and the web server.
const envFile = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^"|"$/g, "");
    }
  }
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3011",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Requires a prior `npm run build`. Always starts (and owns) a fresh
    // server — reusing a leftover one can serve a stale build or die mid-run.
    command: "npm run start -- -p 3011",
    url: "http://127.0.0.1:3011",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
