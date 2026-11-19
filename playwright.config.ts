import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 240_000,
  workers: 1,
  reporter: "list",
  use: { baseURL: process.env.BASE ?? "http://localhost:3300", channel: "msedge", headless: true },
});
