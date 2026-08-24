// Single source of truth for the backend API base URL.
// Set VITE_API_BASE_URL in your .env file (see .env.example).
// Falls back to localhost only for local development convenience.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
