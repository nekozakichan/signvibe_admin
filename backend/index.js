import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import app from './src/app.js';

// Secrets live in Google Secret Manager, bound to this function — never in code,
// never in Firestore.
const MAIL_PASS = defineSecret('MAIL_PASS');
// Encrypts generated account passwords at rest. See services/credentialVault.js.
const CREDENTIAL_KEY = defineSecret('CREDENTIAL_KEY');

export const api = onRequest(
  {
    region: 'asia-southeast1', // Singapore — lowest latency from PH. Change to 'us-central1' if you prefer.
    secrets: [MAIL_PASS, CREDENTIAL_KEY],
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 10, // cost guardrail for a student project
  },
  app
);