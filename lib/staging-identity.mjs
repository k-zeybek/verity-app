import { createHash, createPublicKey } from 'node:crypto';

export function stagingIdentity(key, expectedId) {
  if (!key || !/^[A-Za-z0-9+/]+={0,2}$/.test(key)) {
    throw new Error('Set WXT_EXTENSION_KEY (or WXT_STAGING_EXTENSION_PUBLIC_KEY) to a base64 DER SPKI public key; never use a private key.');
  }
  const der = Buffer.from(key, 'base64');
  let publicKey;
  try { publicKey = createPublicKey({ key: der, format: 'der', type: 'spki' }); }
  catch { throw new Error('Staging key must be a DER SPKI PUBLIC key. Private keys are rejected.'); }
  if (!publicKey.export({ format: 'der', type: 'spki' }).equals(der)) {
    throw new Error('Staging key is not a canonical SPKI public key.');
  }
  const id = [...createHash('sha256').update(der).digest('hex').slice(0, 32)]
    .map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');
  if (!/^[a-p]{32}$/.test(expectedId || '') || id !== expectedId) {
    throw new Error('WXT_STAGING_EXTENSION_ID must match the staging public key SHA-256-derived Chrome ID.');
  }
  // Identity may be shared across environments; service URLs provide routing.
  return { key, id };
}
