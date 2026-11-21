import { db } from '../config/firebase.js';

// ─── Enrollments ──────────────────────────────────────────────────────────────
// A student's account (users/{uid}) stays the same from year to year. What
// changes each school year is their ENROLLMENT:
//
//   enrollments/{schoolYearId}_{uid}
//     { student_id, student_name, student_email,
//       school_year_id, school_year: "2026-2027", start_year: 2026,
//       grade_level: "3", status: "enrolled",
//       retrieved_from: "2025-2026" | null,
//       enrolled_at, enrolled_by, updated_at, updated_by, status_changed_at }
//
// The id makes "one enrollment per student per school year" impossible to
// break. users/{uid}.grade_level always holds the grade for the ACTIVE year.

export const ENROLLMENT_STATUSES = ['enrolled', 'promoted', 'retained', 'completed', 'transferred', 'dropped'];

export const enrollmentId = (schoolYearId, uid) => `${schoolYearId}_${uid}`;

export const buildFullName = (first, middle, last) =>
  [first, middle, last].filter((p) => p && String(p).trim()).join(' ').trim();

/** { id, startYear, schoolYear, isActive } or null. */
export async function getSchoolYear(schoolYearId) {
  if (!schoolYearId || typeof schoolYearId !== 'string') return null;
  const snap = await db.collection('school_years').doc(schoolYearId).get();
  if (!snap.exists) return null;
  const d = snap.data();
  const startYear = Number(d.start_year);
  return { id: snap.id, startYear, schoolYear: `${startYear}-${startYear + 1}`, isActive: d.is_active === true };
}

export async function getActiveSchoolYear() {
  const snap = await db.collection('school_years').where('is_active', '==', true).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const startYear = Number(doc.data().start_year);
  return { id: doc.id, startYear, schoolYear: `${startYear}-${startYear + 1}`, isActive: true };
}

/** Enrollment record for a student in a school year (written with set/merge). */
export function enrollmentData({ uid, student, year, grade, status = 'enrolled', retrievedFrom = null, by }) {
  const now = new Date().toISOString();
  return {
    student_id: uid,
    student_name: student.full_name || buildFullName(student.first_name, student.middle_name, student.last_name),
    student_email: student.email || '',
    school_year_id: year.id,
    school_year: year.schoolYear,
    start_year: year.startYear,
    grade_level: String(grade),
    status,
    retrieved_from: retrievedFrom,
    enrolled_at: now,
    enrolled_by: by || null,
    updated_at: now,
    updated_by: by || null,
    status_changed_at: now,
  };
}
