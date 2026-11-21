import {
  addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../api/firebase';
import { saveAcademicTerm, schoolYearFor, semesterLabel } from './academicTerm';

// ─── School years (the list the admin manages) ───────────────────────────────
//
//   school_years/{autoId}
//     { school_year: "2026-2027", start_year: 2026,
//       start_date: "2026-06-16" | null, end_date: "2027-04-04" | null,
//       semesters: [{ semester: 1, label: "1st Semester", start_date, end_date }],
//       is_active: true | false, active_semester: 1 | 2 | 3 | null,
//       activated_at, deactivated_at, created_at, updated_at, updated_by }
//
// Exactly one school year has is_active: true. Activating one writes every
// school year in a single batch — the chosen one true, all others false — so
// the previous active year is deactivated in the same step and there is never
// a moment with two (or zero) active years.
//
// The active term is also mirrored to settings/academic_term (academicTerm.js),
// which the top bar, Reports and the Android app read.

export const SCHOOL_YEARS = 'school_years';

function normaliseSemester(s) {
  const semester = Number(s?.semester);
  if (!semesterLabel(semester)) return null;
  return {
    semester,
    label: semesterLabel(semester),
    startDate: s.start_date || null,
    endDate: s.end_date || null,
  };
}

function normalise(d) {
  const raw = d.data();
  const startYear = Number(raw.start_year);
  return {
    id: d.id,
    startYear,
    schoolYear: schoolYearFor(startYear),
    startDate: raw.start_date || null,
    endDate: raw.end_date || null,
    isActive: raw.is_active === true,
    activeSemester: Number(raw.active_semester) || null,
    semesters: (Array.isArray(raw.semesters) ? raw.semesters : [])
      .map(normaliseSemester).filter(Boolean)
      .sort((a, b) => a.semester - b.semester),
  };
}

/** Live list, newest school year first. Returns the unsubscribe function. */
export function watchSchoolYears(callback, onError) {
  return onSnapshot(
    collection(db, SCHOOL_YEARS),
    (snap) => callback(
      snap.docs.map(normalise).filter((y) => y.startYear).sort((a, b) => b.startYear - a.startYear)
    ),
    (err) => { console.error('Could not read school years:', err); onError?.(err); }
  );
}

/** The school year marked active, or null when none is set up yet. */
export async function getActiveSchoolYear() {
  const snap = await getDocs(query(collection(db, SCHOOL_YEARS), where('is_active', '==', true)));
  const years = snap.docs.map(normalise).filter((y) => y.startYear);
  return years[0] || null;
}

const semestersPayload = (list) => list
  .slice().sort((a, b) => a.semester - b.semester)
  .map((s) => ({
    semester: s.semester,
    label: semesterLabel(s.semester),
    start_date: s.startDate || null,
    end_date: s.endDate || null,
  }));

export async function addSchoolYear({ startYear, startDate, endDate, semesters = [], uid, isActive = false, activeSemester = null }) {
  const ref = await addDoc(collection(db, SCHOOL_YEARS), {
    school_year: schoolYearFor(startYear),
    start_year: startYear,
    start_date: startDate || null,
    end_date: endDate || null,
    semesters: semestersPayload(semesters),
    is_active: isActive,
    active_semester: isActive ? activeSemester : null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    updated_by: uid || null,
  });
  return ref.id;
}

export async function updateSchoolYear(id, { startYear, startDate, endDate, uid }) {
  await updateDoc(doc(db, SCHOOL_YEARS, id), {
    school_year: schoolYearFor(startYear),
    start_year: startYear,
    start_date: startDate || null,
    end_date: endDate || null,
    updated_at: serverTimestamp(),
    updated_by: uid || null,
  });
}

export async function saveSemesters(id, semesters, uid) {
  await updateDoc(doc(db, SCHOOL_YEARS, id), {
    semesters: semestersPayload(semesters),
    updated_at: serverTimestamp(),
    updated_by: uid || null,
  });
}

/**
 * Activate a school year (and one of its semesters). In ONE batch: the chosen
 * year becomes active, every other year becomes inactive. Then the current
 * term (top bar, Reports, Android app) is switched to match.
 */
export async function activateSchoolYear(allYears, target, semester, uid) {
  if (!target.semesters.some((s) => s.semester === semester)) {
    throw new Error('Add a semester to this school year before activating it.');
  }
  const batch = writeBatch(db);
  allYears.forEach((y) => {
    const ref = doc(db, SCHOOL_YEARS, y.id);
    if (y.id === target.id) {
      batch.update(ref, {
        is_active: true, active_semester: semester,
        ...(y.isActive ? {} : { activated_at: serverTimestamp() }),
        updated_at: serverTimestamp(), updated_by: uid || null,
      });
    } else if (y.isActive || y.activeSemester) {
      batch.update(ref, {
        is_active: false, active_semester: null, deactivated_at: serverTimestamp(),
        updated_at: serverTimestamp(), updated_by: uid || null,
      });
    }
  });
  await batch.commit();
  await saveAcademicTerm({ startYear: target.startYear, semester, uid });
  // Switching to another year: each student's current grade follows their
  // enrollment in that year. Changing only the semester leaves grades alone.
  return target.isActive ? 0 : syncGradesToYear(target.id, uid);
}

/**
 * Set users.grade_level to the grade each student has in the given school
 * year's enrollment. Students with no enrollment in that year keep their
 * current grade. Returns how many accounts changed.
 */
export async function syncGradesToYear(yearId, uid) {
  const [enrollSnap, userSnap] = await Promise.all([
    getDocs(query(collection(db, 'enrollments'), where('school_year_id', '==', yearId))),
    getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
  ]);
  const current = Object.fromEntries(userSnap.docs.map((d) => [d.id, d.data().grade_level]));
  const changes = [];
  enrollSnap.docs.forEach((d) => {
    const { student_id: sid, grade_level: grade } = d.data();
    if (!sid || !grade || !(sid in current)) return;      // account removed
    if (String(current[sid]) !== String(grade)) changes.push([sid, String(grade)]);
  });
  for (let i = 0; i < changes.length; i += 450) {
    const batch = writeBatch(db);
    changes.slice(i, i + 450).forEach(([sid, grade]) => {
      batch.update(doc(db, 'users', sid), { grade_level: grade, updated_at: serverTimestamp(), updated_by: uid || null });
    });
    await batch.commit();
  }
  return changes.length;
}

/**
 * Bring the list in step with the current term when no year is flagged active
 * yet (lists created before the active flag existed): flag the year that
 * matches the current term.
 */
export async function markActiveFromTerm(allYears, term) {
  const match = term && allYears.find((y) => y.startYear === term.startYear);
  if (!match || allYears.some((y) => y.isActive)) return;
  const batch = writeBatch(db);
  batch.update(doc(db, SCHOOL_YEARS, match.id), {
    is_active: true,
    active_semester: match.semesters.some((s) => s.semester === term.semester) ? term.semester : match.semesters[0]?.semester ?? null,
    activated_at: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * First visit after this feature shipped: the school already has a current
 * term (and maybe a history of terms) but no school_years list. Create one
 * entry per school year seen, with the semesters that were used.
 */
export async function seedFromTerm(term, uid) {
  if (!term) return;
  const byYear = new Map();
  [...(term.history || []), term].forEach((t) => {
    if (!t?.startYear || !t?.semester) return;
    if (!byYear.has(t.startYear)) byYear.set(t.startYear, new Set());
    byYear.get(t.startYear).add(t.semester);
  });
  for (const [startYear, sems] of byYear) {
    const current = startYear === term.startYear;
    await addSchoolYear({
      startYear,
      semesters: [...sems].map((semester) => ({ semester })),
      uid,
      isActive: current,
      activeSemester: current ? term.semester : null,
    });
  }
}

// ─── Validation shared by the forms ──────────────────────────────────────────

/** "" if fine, otherwise a message. Dates are "YYYY-MM-DD" strings or empty. */
export function checkDateRange(startDate, endDate, what = 'end date') {
  if (startDate && endDate && endDate < startDate) return `The ${what} must be after the start date.`;
  return '';
}

/** A semester's dates must sit inside its school year's dates, when both are set. */
export function checkInsideYear(year, startDate, endDate) {
  if (year.startDate && startDate && startDate < year.startDate) return `The semester can't start before the school year (${formatDate(year.startDate)}).`;
  if (year.endDate && endDate && endDate > year.endDate) return `The semester can't end after the school year (${formatDate(year.endDate)}).`;
  return '';
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatRange(start, end) {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `Starts ${formatDate(start)}`;
  if (end) return `Ends ${formatDate(end)}`;
  return 'No dates set';
}
