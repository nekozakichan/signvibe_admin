import '../loadEnv.js';
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function resolveCredential() {
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saPath) {
    const fullPath = join(__dirname, '../../', saPath);
    if (existsSync(fullPath)) {
      const serviceAccount = JSON.parse(readFileSync(fullPath, 'utf8'));
      return cert(serviceAccount);
    }
  }
  // No local key file (e.g. running on Cloud Functions):
  // use the runtime's built-in service account via Application Default Credentials.
  return applicationDefault();
}

if (!getApps().length) {
  initializeApp({
    credential: resolveCredential(),
      storageBucket: process.env.APP_FIREBASE_STORAGE_BUCKET,
  });
}

export const auth = getAuth();
export const db = getFirestore();
export const bucket = getStorage().bucket();