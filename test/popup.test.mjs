import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../entrypoints/popup/main.js', import.meta.url), 'utf8');
for (const [mode, dev, origin] of [
  ['staging', false, 'https://verity-site-staging.backnd.workers.dev'],
  ['development', true, 'https://verity-site-staging.backnd.workers.dev'],
  ['production', false, 'https://verity.dpdns.org'],
]) {
  test(`popup links use the correct services in ${mode}`, () => {
    const elements = Object.fromEntries(['verity-beta-link', 'verity-magic-link', 'verity-support-link', 'settingsBtn']
      .map(id => [id, { addEventListener() {} }]));
    vm.runInNewContext(source.replaceAll('import.meta.env.DEV', String(dev))
      .replaceAll('import.meta.env.MODE', JSON.stringify(mode)), {
      console: { log() {} },
      document: { readyState: 'complete', getElementById: id => elements[id] },
      chrome: { storage: { sync: { get() {} } } },
    });
    assert.equal(elements['verity-beta-link'].href, origin + '/beta-access');
    assert.equal(elements['verity-magic-link'].href, origin + '/auth/magic-link');
    assert.equal(elements['verity-support-link'].href, origin + '/support');
  });
}
