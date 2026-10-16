import { auth } from '../api/firebase';

// Single source of truth for the backend API base URL.
//   Production (Firebase Hosting): "" so calls become relative "/api/..."
//     and Hosting's /api/** rewrite proxies them to the Cloud Function.
//   Local dev: the Express server on :8000.
//   An explicit VITE_API_BASE_URL always wins if you set one.
const explicit = import.meta.env.VITE_API_BASE_URL;

export const API_BASE =
  explicit !== undefined && explicit !== ''
    ? explicit
    : import.meta.env.PROD
    ? ''
    : 'http://localhost:8000';
/**
 * fetch() for the SignVibe backend. Sends the signed-in user's Firebase ID
 * token, which the backend checks before doing anything (see
 * backend/src/middleware/requireRole.js). JSON bodies get the right header.
 *
 *   apiFetch('/api/students', { method: 'POST', body: JSON.stringify(data) })
 */
export async function apiFetch(path, options = {}) {
  const token = await auth.currentUser?.getIdToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}
