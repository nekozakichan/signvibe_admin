/**
 * One-off migration: move plaintext account_password out of users/{uid} and into
 * user_credentials/{uid}, encrypted.
 *
 * Run it from the backend folder, on your own machine, where .env.local supplies
 * both FIREBASE_SERVICE_ACCOUNT and CREDENTIAL_KEY:
 *
 *   cd backend
 *   node scripts/migrate-credentials.js --dry-run   # see what would change
 *   node scripts/migrate-credentials.js             # do it
 *
 * Safe to run more than once: accounts already migrated are skipped. Each user
 * is handled in its own batch-free write pair, and the plaintext field is only
 * deleted after the encrypted copy has been written successfully — so an
 * interrupted run leaves readable data behind rather than losing it.
 */

import '../src/loadEnv.js';
import { db } from '../src/config/firebase.js';
import { encryptPassword } from '../src/services/credentialVault.js';
import { FieldValue } from 'firebase-admin/firestore';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (!process.env.CREDENTIAL_KEY) {
    console.error('CREDENTIAL_KEY is not set. Add it to backend/.env.local first.');
    process.exit(1);
  }

  const snapshot = await db.collection('users').get();
  console.log(`Scanning ${snapshot.size} user document(s)…${dryRun ? ' (dry run)' : ''}\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    const uid = doc.id;
    const plaintext = doc.data()?.account_password;
    const label = `${doc.data()?.full_name || '(no name)'} <${doc.data()?.email || '?'}>`;

    if (!plaintext) {
      skipped += 1;
      continue;
    }

    const existing = await db.collection('user_credentials').doc(uid).get();
    if (existing.exists && existing.data()?.password_enc) {
      // Already in the vault — just clear the leftover plaintext.
      if (!dryRun) {
        await db.collection('users').doc(uid).update({
          account_password: FieldValue.delete(),
        });
      }
      console.log(`  cleared plaintext (already vaulted)  ${label}`);
      migrated += 1;
      continue;
    }

    try {
      if (!dryRun) {
        await db.collection('user_credentials').doc(uid).set({
          password_enc: encryptPassword(plaintext),
          updated_at: new Date().toISOString(),
          migrated_at: new Date().toISOString(),
        }, { merge: true });

        // Only now is it safe to drop the readable copy.
        await db.collection('users').doc(uid).update({
          account_password: FieldValue.delete(),
        });
      }
      console.log(`  encrypted + moved                    ${label}`);
      migrated += 1;
    } catch (err) {
      failed += 1;
      console.error(`  FAILED                               ${label}: ${err.message}`);
    }
  }

  console.log(
    `\nDone. ${migrated} migrated, ${skipped} had nothing to migrate, ${failed} failed.` +
    (dryRun ? '\nThis was a dry run — nothing was written.' : '')
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Migration crashed:', err);
  process.exit(1);
});
