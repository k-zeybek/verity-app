import { defineConfig } from 'wxt';
import { resolve } from 'node:path';
import { stagingIdentity } from './lib/staging-identity.mjs';

const userDataDir = resolve(process.cwd(), '.wxt', 'user-data');
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('dev');
// A PR build is compiled (not `wxt dev`), but must still use staging services.
const isStaging = isDev || process.argv.some((arg, i, args) =>
  (arg === '--mode' && args[i + 1] === 'staging') || arg === '--mode=staging'
);

export default defineConfig({
  manifest: () => ({
    name: isStaging ? "Verity - Staging PR Review" : "Verity - AI Fact Checker",
    description: "AI-powered fact-checking for LinkedIn posts. Detect misinformation, logical fallacies, and verify claims with source citations.",
    permissions: ["storage"],
    host_permissions: [
      "*://*.linkedin.com/*",
      isStaging
        ? "https://verity-staging.backnd.workers.dev/*"
        : "https://verity.backnd.workers.dev/*"
    ],
    web_accessible_resources: [{
      resources: ['logo.png'],
      matches: ['*://*.linkedin.com/*']
    }],
    icons: {
      "16": "icon/16.png",
      "32": "icon/32.png",
      "48": "icon/48.png",
      "128": "icon/128.png"
    },
    key: isStaging
      ? stagingIdentity(
          process.env.WXT_STAGING_EXTENSION_PUBLIC_KEY || import.meta.env.WXT_STAGING_EXTENSION_PUBLIC_KEY,
          process.env.WXT_STAGING_EXTENSION_ID || import.meta.env.WXT_STAGING_EXTENSION_ID
        ).key
      : import.meta.env.WXT_EXTENSION_KEY,
    externally_connectable: {
      matches: isStaging
        ? ["https://verity-site-staging.backnd.workers.dev/*"]
        : ["https://verity.dpdns.org/*", "https://verity-site.backnd.workers.dev/*"]
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true
    }
  }),
  webExt: {
    startUrls: ['https://www.linkedin.com'],
    dataPersistence: 'project',
    userDataDir,
    chromiumArgs: [
      `--user-data-dir=${userDataDir}`,
      '--exclude-switches=enable-automation',
      '--disable-features=LockProfileCookieDatabase'
    ]
  }
});