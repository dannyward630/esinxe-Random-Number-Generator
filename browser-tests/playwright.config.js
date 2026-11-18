import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const baseURL = "http://127.0.0.1:8793";
export default defineConfig({
  testDir: ".",
  workers: 1,
  timeout: 45_000,
  globalTimeout: 180_000,
  use: {
    baseURL,
    browserName: "chromium",
    viewport: { width: 960, height: 680 },
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    command:
      "python scripts/build_site.py && python scripts/serve_site.py 8793 --directory _site",
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    url: `${baseURL}/examples/world/`,
    timeout: 30_000,
  },
});
