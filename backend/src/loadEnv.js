// Centralized environment loading.
//   .env       -> production config, deployed to Cloud Functions
//   .env.local -> local overrides + local-only secrets (MAIL_PASS); never used in the cloud
import dotenv from 'dotenv';
import { existsSync } from 'fs';

dotenv.config();

// K_SERVICE / FUNCTION_TARGET are set only inside the deployed Cloud Functions runtime.
// Locally they're absent, so .env.local overrides apply on your machine only.
const isCloudRuntime = !!(process.env.K_SERVICE || process.env.FUNCTION_TARGET);
if (!isCloudRuntime && existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}