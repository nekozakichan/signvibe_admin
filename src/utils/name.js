// Combines separate name fields into one display name.
// Used everywhere we need a "full name" for display, search, or emails.
export function buildFullName({ first_name, middle_name, last_name, full_name }) {
  const parts = [first_name, middle_name, last_name].filter((p) => p && p.trim());
  if (parts.length > 0) return parts.join(' ').trim();
  // Fallback for any legacy records that only have full_name stored
  return full_name || '';
}

// Splits a legacy "full_name" string into best-guess first/middle/last,
// only used to pre-fill edit forms for old records that predate the split.
export function splitFullName(full_name = '') {
  const parts = full_name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: '', middle_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], middle_name: '', last_name: '' };
  if (parts.length === 2) return { first_name: parts[0], middle_name: '', last_name: parts[1] };
  return {
    first_name: parts[0],
    middle_name: parts.slice(1, -1).join(' '),
    last_name: parts[parts.length - 1],
  };
}
