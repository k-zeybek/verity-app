import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { stagingIdentity } from '../lib/staging-identity.mjs';

const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const der = pair.publicKey.export({ format: 'der', type: 'spki' });
const key = der.toString('base64');
const id = [...createHash('sha256').update(der).digest('hex').slice(0, 32)]
  .map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');

test('accepts SPKI public key only when its Chrome ID matches', () => {
  assert.deepEqual(stagingIdentity(key, id), { key, id });
});
test('rejects absent keys and mismatched or absent IDs', () => {
  assert.throws(() => stagingIdentity('', id));
  assert.throws(() => stagingIdentity(key, 'a'.repeat(32)));
  assert.throws(() => stagingIdentity(key, undefined));
});
test('rejects private DER and PEM instead of silently deriving a public key', () => {
  assert.throws(() => stagingIdentity(pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'), id));
  assert.throws(() => stagingIdentity(pair.privateKey.export({ format: 'der', type: 'pkcs1' }).toString('base64'), id));
  assert.throws(() => stagingIdentity(pair.privateKey.export({ format: 'pem', type: 'pkcs8' }), id));
});
