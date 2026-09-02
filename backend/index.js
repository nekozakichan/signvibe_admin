import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import app from './src/app.js';

// SMTP password lives in Google Secret Manager, bound to this function.
const MAIL_PASS = defineSecret('MAIL_PASS');

export const api = onRequest(
  {
    region: 'asia-southeast1', // Singapore — lowest latency from PH. Change to 'us-central1' if you prefer.
    secrets: [MAIL_PASS],
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 10, // cost guardrail for a student project
  },
  app
);