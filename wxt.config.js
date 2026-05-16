import { defineConfig } from 'wxt';
import { resolve } from 'node:path';

// store browser profile (cookies, localStorage, session data) here
const userDataDir = resolve(process.cwd(), '.wxt', 'user-data');

export default defineConfig({
  manifest: () => ({
    name: "Verity - AI Fact Checker",
    description: "AI-powered fact-checking for LinkedIn posts. Detect misinformation, logical fallacies, and verify claims with source citations.",
    permissions: ["storage"],
    host_permissions: [
      "*://*.linkedin.com/*",
      "https://verity.backnd.workers.dev/*"
    ],
    // Icons in 'public/icon/' werden oft automatisch erkannt, 
    // aber hier ist die explizite Definition:
    icons: {
      "16": "icon/16.png",
      "32": "icon/32.png",
      "48": "icon/48.png",
      "128": "icon/128.png"
    },
    key: import.meta.env.WXT_EXTENSION_KEY,
  }),
  runner: {
    startUrls: ['https://www.linkedin.com'],
    dataPersistence: 'project',
    userDataDir,
    chromiumArgs: [
      `--user-data-dir=${userDataDir}`
    ],
  }
});