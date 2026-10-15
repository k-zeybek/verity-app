import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { appendFile } from 'node:fs/promises';
import { stagingIdentity } from '../lib/staging-identity.mjs';

const { key, id } = stagingIdentity(
  process.env.WXT_STAGING_EXTENSION_PUBLIC_KEY,
  process.env.WXT_STAGING_EXTENSION_ID
);
const root = '.output/chrome-mv3-staging';
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.key, key, 'Manifest must contain the validated staging public key');
assert.deepEqual(manifest.host_permissions, [
  '*://*.linkedin.com/*', 'https://verity-staging.backnd.workers.dev/*'
]);
assert.deepEqual(manifest.externally_connectable.matches, [
  'https://verity-site-staging.backnd.workers.dev/*'
]);
assert.equal(manifest.name, 'Verity - Staging PR Review');

async function sources(dir) {
  const chunks = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) chunks.push(...await sources(path));
    else if (/\.(js|html|json)$/.test(entry.name)) chunks.push(await readFile(path, 'utf8'));
    assert(!/\.(pem|key|p12|pfx)$/i.test(entry.name), 'Private key files must never enter the artifact');
  }
  return chunks;
}
const compiled = (await sources(root)).join('\n');
for (const target of [
  'https://verity-staging.backnd.workers.dev',
  'https://verity-site-staging.backnd.workers.dev',
  'https://cyeqmgrqmntkjaznycic.supabase.co'
]) assert(compiled.includes(target), 'Missing staging endpoint: ' + target);
for (const forbidden of [
  'https://verity.backnd.workers.dev',
  'https://verity.dpdns.org',
  'https://verity-site.backnd.workers.dev',
  'https://gpyxoibtcjuabmujrxpq.supabase.co',
  'sb_publishable_RMvnK4S1r7txxEFAqmEWFg_L4OkhGwx',
  'PRIVATE KEY'
]) assert(!compiled.includes(forbidden), 'Production configuration or private key material in staging artifact: ' + forbidden);

// Read the deployed Cloudflare site's client bundles, not just source configuration.
// No Cloudflare write or deployment is performed.
const origin = 'https://verity-site-staging.backnd.workers.dev';
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  assert(response.ok, 'Cannot verify deployed staging website: HTTP ' + response.status);
  return response.text();
}
const html = await get(origin);
const pending = [...html.matchAll(/(?:src|href)=["']([^"']+\.js)["']/g)]
  .map(match => new URL(match[1], origin).href);
const visited = new Set();
let website = html;
while (pending.length) {
  const url = pending.shift();
  if (visited.has(url)) continue;
  assert.equal(new URL(url).origin, origin, 'Only fetch staging website assets');
  assert(visited.size < 100, 'Unexpected staging asset graph size');
  visited.add(url);
  const text = await get(url);
  website += '\n' + text;
  for (const match of text.matchAll(/["']((?:\.?\.?\/)?assets\/[\w-]+\.js|\.\/[\w-]+\.js)["']/g)) {
    pending.push(new URL(match[1], match[1].startsWith('assets/') ? origin + '/' : url).href);
  }
}
assert(website.includes('sendMessage'), 'Could not locate staging website extension authentication code');
const websiteIds = new Set([...website.matchAll(/\b[a-p]{32}\b/g)].map(match => match[0]));
assert.deepEqual([...websiteIds], [id],
  'Deployed staging website VITE_EXTENSION_ID must match the staging public key; rebuild/deploy the site after configuring it.');
assert(website.includes('https://cyeqmgrqmntkjaznycic.supabase.co'), 'Staging website must use staging Supabase');
assert(!website.includes('https://gpyxoibtcjuabmujrxpq.supabase.co'), 'Staging website contains production Supabase');

console.log('Verified staging extension ID: ' + id);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY,
    'Verified manifest public key, staging-only endpoints and deployed staging website extension ID: `' + id + '`.\n');
}
