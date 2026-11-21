import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/firebase.js';
import { archiveUserRecord } from '../services/firebaseService.js';
import { sendAccountArchivedEmail } from '../services/mailerService.js';

// ─── POST /api/school-year/start ──────────────────────────────────────────────
// End the current school year and start the next one, in one step:
//
//   promote   → grade_level + 1                       (Grades 1–5)
//   retain    → stays in the same grade
//   complete  → finished Grade 6: archived, emailed   (Grade 6 only)
//
// Every student's outcome is appended to users/{uid}.grade_history, so the
// record of which grade they were in each year survives the change. The new
// term is written to settings/academic_term (1st Semester).
//
// Body: { startYear: 2027, decisions: [{ uid, action }] }

const ACTIONS = ['promote', 'retain', 'complete'];

const schoolYearFor = (y) => `${y}-${y + 1}`;

export const startNewSchoolYear = async (req, res) => {
  const startYear = Number(req.body?.startYear);
  const decisions = Array.isArray(req.body?.decisions) ? req.body.decisions : [];

  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) {
    return res.status(400).json({ success: false, message: 'Choose a valid new school year.' });
  }

  try {
    // Guard against running it twice (which would promote everyone twice):
    // the new year must come after the one currently set.
    const termRef = db.collection('settings').doc('academic_term');
    const termSnap = await termRef.get();
    const current = termSnap.exists ? termSnap.data() : null;
    const currentStart = Number(current?.start_year) || null;
    if (currentStart && startYear <= currentStart) {
      return res.status(409).json({
        success: false,
        message: `The school is already in S.Y. ${schoolYearFor(currentStart)}. The new school year must come after it.`,
      });
    }
    // Never run the same year twice, even if the admin later set an older
    // school year active again (that would move students up a second time).
    const alreadyStarted = Array.isArray(current?.rolled_over_to) ? current.rolled_over_to.map(Number) : [];
    if (alreadyStarted.includes(startYear)) {
      return res.status(409).json({
        success: false,
        message: `S.Y. ${schoolYearFor(startYear)} was already started with this step, so students were already moved up for it.`,
      });
    }
    const endingYear = currentStart ? schoolYearFor(currentStart) : 'previous school year';

    // Every non-archived student must have a decision, and only valid ones.
    const studentSnap = await db.collection('users').where('role', '==', 'student').get();
    const students = new Map(
      studentSnap.docs
        .filter((d) => d.data().status !== 'archived')
        .map((d) => [d.id, d.data()])
    );

    const byUid = new Map();
    for (const d of decisions) {
      if (!d || !students.has(d.uid) || !ACTIONS.includes(d.action)) {
        return res.status(400).json({ success: false, message: 'The student list changed. Reload the page and try again.' });
      }
      byUid.set(d.uid, d.action);
    }
    if (byUid.size !== students.size) {
      return res.status(400).json({ success: false, message: 'The student list changed. Reload the page and try again.' });
    }

    const promoted = [];
    const retained = [];
    const completed = [];
    for (const [uid, action] of byUid) {
      const grade = parseInt(students.get(uid).grade_level, 10);
      if (!Number.isInteger(grade) || grade < 1 || grade > 6) {
        return res.status(400).json({ success: false, message: `${students.get(uid).full_name || uid} has no valid grade level.` });
      }
      if (action === 'promote' && grade >= 6) {
        return res.status(400).json({ success: false, message: 'Grade 6 students can finish or stay, not move up.' });
      }
      if (action === 'complete' && grade !== 6) {
        return res.status(400).json({ success: false, message: 'Only Grade 6 students can be marked as completed.' });
      }
      ({ promote: promoted, retain: retained, complete: completed })[action].push({ uid, grade });
    }

    const now = new Date().toISOString();
    const historyEntry = (grade, outcome) => FieldValue.arrayUnion({
      school_year: endingYear,
      grade_level: String(grade),
      outcome,
      recorded_at: now,
    });

    // Grade changes + history, in batches (Firestore allows 500 writes each).
    const writes = [
      ...promoted.map(({ uid, grade }) => [uid, {
        grade_level: String(grade + 1),
        grade_history: historyEntry(grade, 'promoted'),
      }]),
      ...retained.map(({ uid, grade }) => [uid, {
        grade_history: historyEntry(grade, 'retained'),
      }]),
      ...completed.map(({ uid, grade }) => [uid, {
        grade_history: historyEntry(grade, 'completed'),
      }]),
    ];
    for (let i = 0; i < writes.length; i += 450) {
      const batch = db.batch();
      writes.slice(i, i + 450).forEach(([uid, data]) => batch.set(db.collection('users').doc(uid), data, { merge: true }));
      await batch.commit();
    }

    // Grade 6 finishers: archive (disables login, keeps records) + email.
    const reason = `Completed Grade 6 in S.Y. ${endingYear}. Congratulations on finishing elementary!`;
    let emailsFailed = 0;
    for (const { uid } of completed) {
      await archiveUserRecord(uid, reason);
      const s = students.get(uid);
      try {
        await sendAccountArchivedEmail({ full_name: s.full_name, email: s.email, reason, role: 'student' });
      } catch {
        emailsFailed += 1;
      }
    }

    // Finally switch the school to the new year, 1st Semester, and record when
    // it started (Reports uses this history to split records by school year).
    const history = Array.isArray(current?.history) ? [...current.history] : [];
    if (history.length === 0 && currentStart) {
      history.push({
        school_year: schoolYearFor(currentStart), start_year: currentStart,
        semester: Number(current.semester) || 1, semester_label: current.semester_label || '1st Semester',
        started_at: new Date(0).toISOString(),
      });
    }
    history.push({
      school_year: schoolYearFor(startYear), start_year: startYear,
      semester: 1, semester_label: '1st Semester', started_at: now,
    });
    await termRef.set({
      school_year: schoolYearFor(startYear),
      start_year: startYear,
      semester: 1,
      semester_label: '1st Semester',
      updated_at: FieldValue.serverTimestamp(),
      updated_by: req.user.uid,
      last_rollover: { from: endingYear, at: now, by: req.user.uid },
      rolled_over_to: FieldValue.arrayUnion(startYear),
      history,
    }, { merge: true });

    // Make sure the new year is in the School Year Management list, with a
    // 1st Semester (it may already exist if the admin added it ahead of time).
    const firstSem = { semester: 1, label: '1st Semester', start_date: null, end_date: null };
    const existing = await db.collection('school_years').where('start_year', '==', startYear).get();
    if (existing.empty) {
      await db.collection('school_years').add({
        school_year: schoolYearFor(startYear), start_year: startYear,
        start_date: null, end_date: null, semesters: [firstSem],
        created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(), updated_by: req.user.uid,
      });
    } else {
      const yearDoc = existing.docs[0];
      const sems = Array.isArray(yearDoc.data().semesters) ? yearDoc.data().semesters : [];
      if (!sems.some((x) => Number(x.semester) === 1)) {
        await yearDoc.ref.set({
          semesters: [firstSem, ...sems].sort((a, b) => Number(a.semester) - Number(b.semester)),
          updated_at: FieldValue.serverTimestamp(), updated_by: req.user.uid,
        }, { merge: true });
      }
    }

    return res.json({
      success: true,
      schoolYear: schoolYearFor(startYear),
      promoted: promoted.length,
      retained: retained.length,
      completed: completed.length,
      emailsFailed,
    });
  } catch (err) {
    console.error('startNewSchoolYear failed:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
