// Same rule as the backend (backend/src/utils/email.js). Checked before the
// request is sent, so a typo gets a clear message instead of a server error.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed, lower-cased email, or '' when missing. */
export const normalizeEmail = (raw) => String(raw || '').trim().toLowerCase();

export const isValidEmail = (email) => EMAIL_RE.test(normalizeEmail(email));

export const INVALID_EMAIL_MESSAGE = 'Enter a valid email address, e.g. name@gmail.com.';
