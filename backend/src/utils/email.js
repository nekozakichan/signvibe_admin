// One email rule for every endpoint that creates or changes a login, so a bad
// address is turned away with a clear message before it reaches Firebase Auth.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed, lower-cased email, or '' when missing. */
export const normalizeEmail = (raw) => String(raw || '').trim().toLowerCase();

export const isValidEmail = (email) => EMAIL_RE.test(email);

export const INVALID_EMAIL_MESSAGE = 'Enter a valid email address, e.g. name@gmail.com.';
