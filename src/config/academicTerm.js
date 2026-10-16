import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../api/firebase';

// ─── School year & semester ───────────────────────────────────────────────────
// The term the whole school is currently in, set by the admin.
//
// THE SOURCE OF TRUTH IS FIRESTORE: settings/academic_term
//
//   { school_year: "2026-2027", start_year: 2026,
//     semester: 1, semester_label: "1st Semester",
//     updated_at, updated_by,
//     history: [{ school_year, start_year, semester, semester_label, started_at }] }
//
// `history` records when each term began. Quiz results and lesson completions
// already carry a date, so a record belongs to whichever term had started most
// recently at that moment — that's how Reports filters by school year without
// the Android app having to save the term on every record.
//
// Every signed-in user can read it (the web panel shows it in the top bar, and
// the Android app can too); only an admin can change it — see firestore.rules.

export const SETTINGS_COLLECTION = 'settings';
export const ACADEMIC_TERM_DOC = 'academic_term';

export const SEMESTERS = [
  { value: 1, label: '1st Semester' },
  { value: 2, label: '2nd Semester' },
  { value: 3, label: '3rd Semester' },
];

export function semesterLabel(value) {
  return SEMESTERS.find((s) => s.value === Number(value))?.label || '';
}

/** "2026-2027" for a school year starting in 2026. */
export function schoolYearFor(startYear) {
  return `${startYear}-${startYear + 1}`;
}

/**
 * Read a school year the admin typed. Accepts "2026-2027", "2026 - 2027",
 * "2026–2027" or just "2026" (taken as 2026-2027).
 * Returns { startYear } or { error } explaining what's wrong.
 */
export function parseSchoolYear(text) {
  const value = String(text || '').trim();
  if (!value) return { error: 'Type the school year, e.g. 2026-2027.' };

  const match = value.match(/^(\d{4})(?:\s*[-–—/]\s*(\d{4}))?$/);
  if (!match) return { error: 'Use the format 2026-2027.' };

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start + 1;
  if (start < 2000 || start > 2100) return { error: 'The year should be between 2000 and 2100.' };
  if (end !== start + 1) return { error: `The second year should be ${start + 1} (one year after ${start}).` };
  return { startYear: start };
}

/**
 * The school year a date falls in. Philippine school years open in June, so
 * January–May still belong to the year that started the previous June.
 */
export function guessStartYear(date = new Date()) {
  return date.getMonth() >= 5 ? date.getFullYear() : date.getFullYear() - 1;
}

function normalise(raw) {
  if (!raw) return null;
  const startYear = Number(raw.start_year) || Number(String(raw.school_year || '').slice(0, 4));
  const semester = Number(raw.semester);
  if (!startYear || !semesterLabel(semester)) return null;
  return {
    startYear,
    schoolYear: schoolYearFor(startYear),
    semester,
    semesterLabel: semesterLabel(semester),
    updatedAt: raw.updated_at?.toDate?.() ?? null,
    history: normaliseHistory(raw.history),
  };
}

function normaliseHistory(list) {
  return (Array.isArray(list) ? list : [])
    .map((h) => ({
      startYear: Number(h.start_year),
      schoolYear: schoolYearFor(Number(h.start_year)),
      semester: Number(h.semester),
      semesterLabel: semesterLabel(h.semester),
      startedAt: new Date(h.started_at).getTime(),
    }))
    .filter((h) => h.startYear && h.semesterLabel && !Number.isNaN(h.startedAt))
    .sort((a, b) => a.startedAt - b.startedAt);
}

/**
 * The term a moment in time belongs to: the latest term that had started by
 * then. Anything older than the first recorded term counts as that first term.
 * `when` may be a Date, a millisecond number, an ISO string or a Firestore
 * Timestamp. Returns null if there's no history or no usable date.
 */
export function termAt(history, when) {
  if (!history?.length || when === null || when === undefined) return null;
  const ms = when?.seconds !== undefined ? when.seconds * 1000
    : when instanceof Date ? when.getTime()
    : typeof when === 'number' ? when
    : new Date(when).getTime();
  if (Number.isNaN(ms)) return null;
  let found = history[0];
  for (const h of history) {
    if (h.startedAt <= ms) found = h; else break;
  }
  return found;
}

/** One-off read. Returns null when no term has been set yet. */
export async function loadAcademicTerm() {
  const snap = await getDoc(doc(db, SETTINGS_COLLECTION, ACADEMIC_TERM_DOC));
  return snap.exists() ? normalise(snap.data()) : null;
}

/**
 * Live read: calls back with the term (or null) now and on every change, so the
 * top bar updates the moment the admin saves. Returns the unsubscribe function.
 */
export function watchAcademicTerm(callback) {
  return onSnapshot(
    doc(db, SETTINGS_COLLECTION, ACADEMIC_TERM_DOC),
    (snap) => callback(snap.exists() ? normalise(snap.data()) : null),
    (err) => {
      console.error('Could not read the academic term:', err);
      callback(null);
    }
  );
}

const EPOCH = new Date(0).toISOString();
const CORRECTION_WINDOW_MS = 10 * 60 * 1000;

export async function saveAcademicTerm({ startYear, semester, uid }) {
  const year = Math.round(Number(startYear));
  if (!year || !semesterLabel(semester)) throw new Error('Choose a school year and a semester.');

  const ref = doc(db, SETTINGS_COLLECTION, ACADEMIC_TERM_DOC);
  const snap = await getDoc(ref);
  const raw = snap.exists() ? snap.data() : {};
  let history = Array.isArray(raw.history) ? [...raw.history] : [];

  // First change since history began: the term being replaced has been in
  // effect "since the beginning", so earlier records still belong to it.
  if (history.length === 0 && raw.start_year && raw.semester) {
    history.push({
      school_year: raw.school_year, start_year: raw.start_year,
      semester: raw.semester, semester_label: raw.semester_label || semesterLabel(raw.semester),
      started_at: EPOCH,
    });
  }

  const entry = {
    school_year: schoolYearFor(year), start_year: year,
    semester: Number(semester), semester_label: semesterLabel(semester),
    started_at: new Date().toISOString(),
  };
  const last = history[history.length - 1];
  const isSameTerm = last && Number(last.start_year) === year && Number(last.semester) === Number(semester);
  const justSet = last && last.started_at !== EPOCH
    && Date.now() - new Date(last.started_at).getTime() < CORRECTION_WINDOW_MS;
  if (isSameTerm) {
    // Nothing new started — keep the existing start time.
  } else if (justSet) {
    history[history.length - 1] = { ...entry, started_at: last.started_at }; // a quick correction
  } else {
    history.push(entry);
  }

  await setDoc(ref, {
    school_year: entry.school_year,
    start_year: year,
    semester: entry.semester,
    semester_label: entry.semester_label,
    updated_at: serverTimestamp(),
    updated_by: uid || null,
    history,
  }, { merge: true });
  return loadAcademicTerm();
}
