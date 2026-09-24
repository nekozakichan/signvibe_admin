import '../loadEnv.js';
import crypto from 'node:crypto';

// ─── Credential vault ─────────────────────────────────────────────────────────
// Teachers need to re-send a student their password weeks after the account was
// made, so the password has to be recoverable — a hash can't be undone, which is
// exactly why a hash is the wrong tool here. Instead the password is ENCRYPTED
// at rest with AES-256-GCM.
//
// What that buys us: the stored value is meaningless without the key, and the
// key lives in Google Secret Manager (CREDENTIAL_KEY), never in Firestore. Anyone
// reading the database — console, export, a leaked backup — sees ciphertext.
//
// GCM also authenticates: tampering with a stored value makes decryption fail
// loudly rather than returning garbage.
//
// Stored format (one string, so it drops into the existing field shape):
//   v1.<iv base64>.<auth tag base64>.<ciphertext base64>

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;          // 96-bit nonce, the size GCM is specified for
const KEY_BYTES = 32;         // AES-256
const SCRYPT_SALT = 'signvibe-credential-vault';

let cachedKey = null;

/**
 * CREDENTIAL_KEY may be either a base64-encoded 32-byte key (what
 * `openssl rand -base64 32` gives you) or any passphrase, which is stretched
 * with scrypt. The first is preferred; the second means a weak passphrase
 * yields a weak key, so use a generated one.
 */
function getKey() {
  if (cachedKey) return cachedKey;

  const secret = process.env.CREDENTIAL_KEY;
  if (!secret) {
    throw new Error(
      'CREDENTIAL_KEY is not set. Generate one with `openssl rand -base64 32` and store it ' +
      'with `firebase functions:secrets:set CREDENTIAL_KEY` (and in backend/.env.local for local runs).'
    );
  }

  const asBase64 = Buffer.from(secret, 'base64');
  cachedKey = asBase64.length === KEY_BYTES
    ? asBase64
    : crypto.scryptSync(secret, SCRYPT_SALT, KEY_BYTES);

  return cachedKey;
}

/** True for a value this module produced — anything else is legacy plaintext. */
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(`${VERSION}.`);
}

export function encryptPassword(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptPassword expects a non-empty string.');
  }

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

/**
 * Turn a stored value back into the password.
 *
 * Values written before the vault existed are plaintext and have no version
 * prefix; those are returned unchanged so "Send Credentials" keeps working for
 * accounts that haven't been migrated yet. Run scripts/migrate-credentials.js
 * to clear them out.
 */
export function decryptPassword(stored) {
  if (typeof stored !== 'string' || stored.length === 0) return null;
  if (!isEncrypted(stored)) return stored; // legacy plaintext

  const [, ivB64, tagB64, dataB64] = stored.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Stored credential is malformed.');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
