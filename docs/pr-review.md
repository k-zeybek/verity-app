# PR extension review

PR builds run tests, compile WXT in staging mode, verify the compiled manifest and endpoints,
check the deployed staging website's extension ID, and upload an unpacked Chrome extension.
They do not publish a release or deploy any Cloudflare service.

## Identity and configuration

PR builds reuse the existing extension identity by default:
`lbclfdjfnjioekbigjgeonajdjblcpmd`. Staging mode selects the staging website,
backend and authentication services independently of the extension ID.

The workflow reads the public manifest key from the existing Actions variable or
secret `WXT_EXTENSION_KEY`. No separate staging identity is required. Optional
repository variables `WXT_STAGING_EXTENSION_PUBLIC_KEY` and
`WXT_STAGING_EXTENSION_ID` override the identity when both match the staging website.
For local dev, the existing `WXT_EXTENSION_KEY` in your WXT env file also works.
The value must be a base64 DER SPKI public key; actual private signing keys are rejected.
If a fork PR cannot access a secret-held public key, store the validated public
manifest key in the repository variable `WXT_EXTENSION_KEY` instead.

The deployed staging website's build-time `VITE_EXTENSION_ID` must match the
selected identity. No website rebuild is needed when it already uses the shared ID.
Changing identities requires rebuilding/deploying the staging website.

Use a separate Chrome profile for review builds: production and staging copies
with the same ID cannot coexist independently within one profile. The separate
profile also keeps their local sessions apart.

## Install

1. Open the PR's Checks tab and select Test and build staging extension > Details.
2. Open the workflow run's Summary. Click Download PR extension or the
   verity-chrome-staging-pr-<number> artifact. Sign in to GitHub to download it.
3. Extract the ZIP into a persistent folder.
4. Open chrome://extensions and enable Developer mode.
5. Click Load unpacked and select the extracted folder containing manifest.json.
6. Verify the extension is named Verity - Staging PR Review and its ID equals
   the workflow's expected extension ID. Stop testing if the ID differs.
7. Install in a separate Chrome profile from production.

## Test

1. Reload LinkedIn after installing. Open the extension popup and its options.
2. Sign in through the extension's staging website link. Complete the existing magic-link
   flow using a staging account. The callback must return through
   https://verity-site-staging.backnd.workers.dev and deliver the session to the staging ID.
3. Analyze a LinkedIn post. Inspect the page's DevTools Network panel for requests to
   https://verity-staging.backnd.workers.dev.
4. Inspect extension errors and service-worker DevTools from chrome://extensions.
   Authentication refresh requests must use https://cyeqmgrqmntkjaznycic.supabase.co.
   No requests should target the production backend, website or Supabase project.
5. For a newer PR commit, download its new artifact, replace the extracted folder,
   click Reload on the extension and reload LinkedIn.

Each run retains its artifact for 14 days. Chrome requires manual Load unpacked;
a web button cannot silently install an unpacked extension.
The existing manual production release workflow and production key selection remain unchanged.
