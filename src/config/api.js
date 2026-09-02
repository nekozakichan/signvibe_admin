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