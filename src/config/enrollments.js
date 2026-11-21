import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../api/firebase';
import { getActiveSchoolYear } from './schoolYears';

// ─── Enrollments (read side) ──────────────────────────────────────────────────
// enrollments/{schoolYearId}_{uid}: one record per student per school year,
// holding that year's grade and status. Written only by the backend
// (/api/enrollments, /api/students) — see backend/src/services/enrollmentService.js.

// "completed" is stored for a student who finished Grade 6 and is shown as
// "Graduated". The value stays "completed" so existing records keep working.
export const GRADUATED = 'completed';

export const ENROLLMENT_STATUSES = [
  { value: 'enrolled',    label: 'Enrolled',    color: '#00838A', bg: '#00838A18' },
  { value: 'promoted',    label: 'Promoted',    color: '#2E7D32', bg: '#2E7D3218' },
  { value: 'retained',    label: 'Retained',    color: '#B26A00', bg: '#d9770618' },
  { value: 'completed',   label: 'Graduated',   color: '#6A1B9A', bg: '#6A1B9A18' },
  { value: 'transferred', label: 'Transferred', color: '#1565C0', bg: '#1565C018' },
  { value: 'dropped',     label: 'Dropped',     color: '#C62828', bg: '#C6282818' },
];

export const statusInfo = (value) =>
  ENROLLMENT_STATUSES.find((s) => s.value === value) || ENROLLMENT_STATUSES[0];

const toRecord = (d) => ({ id: d.id, ...d.data() });

/** All enrollment records of one school year. */
export async function loadEnrollmentsForYear(schoolYearId) {
  if (!schoolYearId) return [];
  const snap = await getDocs(query(collection(db, 'enrollments'), where('school_year_id', '==', schoolYearId)));
  return snap.docs.map(toRecord);
}

/** Every enrollment record (for Student Records search). */
export async function loadAllEnrollments() {
  const snap = await getDocs(collection(db, 'enrollments'));
  return snap.docs.map(toRecord);
}

/** Choice in the Retrieve dialog for a Grade 6 student who is graduating. */
export const GRADUATE_CHOICE = 'graduate';

/**
 * Default choice when retrieving a student into the next school year: the
 * next grade, the same grade if they were retained, or GRADUATE_CHOICE for
 * a Grade 6 who finished.
 */
export function suggestedNextGrade(prev) {
  const g = parseInt(prev.grade_level, 10) || 1;
  if (prev.status === 'retained') return g;
  if (g >= 6) return GRADUATE_CHOICE;
  return g + 1;
}

/** Whether a student from a previous year should be ticked by default. */
export function retrieveByDefault(prev, user) {
  if (!user || user.status === 'archived') return false;
  return !['completed', 'transferred', 'dropped'].includes(prev.status);
}

// Enrollment statuses that mean the student left during the year.
export const LEFT_STATUSES = ['transferred', 'dropped'];

/**
 * The students in the current (active) school year: accounts that are not
 * archived AND have an enrollment in that year that isn't transferred or
 * dropped. Each student carries that year's grade_level and its enrollment.
 *
 * Students enrolled only in another year (e.g. an upcoming one) are left out.
 * When no school year is active yet, every non-archived account is returned,
 * the same fallback the Students List uses before school years are set up.
 *
 * Returns { year, students } — year is null in the fallback case.
 */
export async function loadCurrentStudents() {
  const [studentSnap, year] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
    getActiveSchoolYear(),
  ]);
  const accounts = studentSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => s.status !== 'archived');
  if (!year) return { year: null, students: accounts };

  const byId = new Map(accounts.map((a) => [a.id, a]));
  const seen = new Set();
  const students = [];
  (await loadEnrollmentsForYear(year.id)).forEach((e) => {
    const account = byId.get(e.student_id);
    if (!account || seen.has(e.student_id) || LEFT_STATUSES.includes(e.status)) return;
    seen.add(e.student_id);
    students.push({ ...account, grade_level: e.grade_level, enrollment: e });
  });
  return { year, students };
}
