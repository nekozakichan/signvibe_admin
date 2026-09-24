import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../api/firebase';

// ─── Quiz length per grade level ──────────────────────────────────────────────
// How many items a student answers in one module quiz, set by their grade so
// younger learners get a shorter sitting.
//
// THE SOURCE OF TRUTH IS FIRESTORE: settings/quiz_limits
//
//   { items_by_grade: { "1": 5, "2": 10, "3": 15, "4": 18, "5": 20, "6": 20 },
//     default_items: 20 }
//
// Both this web admin and the Android app read that one document, so the rule
// only ever has to be changed in one place. The table below is a last-resort
// fallback for when the document is missing or unreadable — it is not the
// authority, and editing it will NOT change what students get.

export const SETTINGS_COLLECTION = 'settings';
export const QUIZ_LIMITS_DOC = 'quiz_limits';

export const GRADE_LEVELS = [1, 2, 3, 4, 5, 6];

/** Offline fallback only. The Firestore document wins whenever it can be read. */
export const FALLBACK_ITEMS_BY_GRADE = {
  1: 5,
  2: 10,
  3: 15,
  4: 18,
  5: 20,
  6: 20,
};

/** Used for a grade that is missing, unreadable, or outside 1–6. */
export const FALLBACK_DEFAULT_ITEMS = 20;

export const FALLBACK_LIMITS = {
  itemsByGrade: { ...FALLBACK_ITEMS_BY_GRADE },
  defaultItems: FALLBACK_DEFAULT_ITEMS,
  source: 'fallback',
};

// Read once per page load; the numbers change rarely and every module's quiz
// panel would otherwise re-fetch the same document.
let cache = null;
let inFlight = null;

function normalise(raw) {
  const itemsByGrade = {};
  GRADE_LEVELS.forEach((grade) => {
    const value = Number(raw?.items_by_grade?.[grade] ?? raw?.items_by_grade?.[String(grade)]);
    itemsByGrade[grade] = Number.isFinite(value) && value > 0
      ? Math.round(value)
      : FALLBACK_ITEMS_BY_GRADE[grade];
  });

  const fallbackDefault = Number(raw?.default_items);
  return {
    itemsByGrade,
    defaultItems: Number.isFinite(fallbackDefault) && fallbackDefault > 0
      ? Math.round(fallbackDefault)
      : FALLBACK_DEFAULT_ITEMS,
    source: 'firestore',
    updatedAt: raw?.updated_at ?? null,
  };
}

/**
 * Load the limits from Firestore, falling back to the built-in table if the
 * document doesn't exist yet or can't be read. Never throws — a quiz panel
 * should still render if the settings read fails.
 */
export async function loadQuizLimits({ force = false } = {}) {
  if (cache && !force) return cache;
  if (inFlight && !force) return inFlight;

  inFlight = (async () => {
    try {
      const snap = await getDoc(doc(db, SETTINGS_COLLECTION, QUIZ_LIMITS_DOC));
      cache = snap.exists() ? normalise(snap.data()) : { ...FALLBACK_LIMITS, missing: true };
    } catch (err) {
      console.error('Could not read quiz limits, using defaults:', err);
      cache = { ...FALLBACK_LIMITS, error: true };
    } finally {
      inFlight = null;
    }
    return cache;
  })();

  return inFlight;
}

/**
 * Write the limits back. This is what makes the Firestore document the source
 * of truth — the Android app picks the new numbers up on its next quiz.
 */
export async function saveQuizLimits(itemsByGrade, { defaultItems = FALLBACK_DEFAULT_ITEMS, uid } = {}) {
  const payload = {
    items_by_grade: {},
    default_items: Math.round(defaultItems),
    updated_at: serverTimestamp(),
    updated_by: uid || null,
  };
  GRADE_LEVELS.forEach((grade) => {
    payload.items_by_grade[String(grade)] = Math.round(itemsByGrade[grade]);
  });

  await setDoc(doc(db, SETTINGS_COLLECTION, QUIZ_LIMITS_DOC), payload, { merge: true });

  cache = null;              // next read picks up what we just wrote
  return loadQuizLimits({ force: true });
}

/**
 * Items a student of this grade should be given.
 * Accepts a number or a string — Firestore stores grade_level as a string.
 */
export function quizItemsForGrade(gradeLevel, limits = FALLBACK_LIMITS) {
  const grade = parseInt(gradeLevel, 10);
  return limits.itemsByGrade?.[grade] ?? limits.defaultItems ?? FALLBACK_DEFAULT_ITEMS;
}
