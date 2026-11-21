import { db } from '../config/firebase.js';
import { sendCongratulationsEmail } from '../services/mailerService.js';
import {
  ENROLLMENT_STATUSES,
  enrollmentData,
  enrollmentId,
  getSchoolYear,
} from '../services/enrollmentService.js';

const validGrade = (g) => Number.isInteger(g) && g >= 1 && g <= 6;

// "completed" is the stored status for a student who finished Grade 6; the
// web app shows it as "Graduated".
const GRADUATED = 'completed';

/**
 * Send congratulation emails and mark each enrollment so the same student is
 * never congratulated twice for the same year. A failed email never undoes the
 * enrollment change — it is only counted and reported back.
 *
 * items: [{ enrollmentRef, full_name, email, kind, fromGrade, toGrade, schoolYear, nextSchoolYear }]
 */
async function sendCongrats(items) {
  const sendOne = async (item) => {
    if (!item.email) throw new Error('No email address');
    const { enrollmentRef, ...mail } = item;
    await sendCongratulationsEmail(mail);
    await enrollmentRef.set({ congrats_sent_at: new Date().toISOString() }, { merge: true });
  };
  // Three at a time: fast enough for a class, gentle on Gmail's SMTP limits.
  const results = [];
  for (let i = 0; i < items.length; i += 3) {
    results.push(...await Promise.allSettled(items.slice(i, i + 3).map(sendOne)));
  }
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? { name: items[i].full_name, reason: r.reason?.message || 'Unknown error' } : null))
    .filter(Boolean);
  if (failed.length) console.error('Congratulation emails failed:', failed);
  return { sent: results.length - failed.length, failed };
}

// ─── POST /api/enrollments ────────────────────────────────────────────────────
// Enroll existing students into a school year — this is also "retrieve
// students from a previous school year": the teacher ticks students from an
// old year and gives each their grade for the new one, nothing re-encoded.
//
// Body: { school_year_id, from_school_year_id?, send_congrats?,
//         entries: [{ uid, grade_level } | { uid, graduate: true }] }
//
// - Students already enrolled in the target year are skipped (reported back).
// - Archived accounts are skipped (restore them first).
// - If the target is the ACTIVE year, the student's current grade is updated.
// - When retrieving, the old year's record is closed as "promoted" (higher
//   grade) or "retained" (same grade) if it was still just "enrolled".
// - { graduate: true } (Grade 6 only, when retrieving): the student is NOT
//   enrolled in the new year; the old year's record is closed as graduated
//   and the account is marked graduated so it isn't flagged as "not enrolled".
// - Promoted and graduated students get a congratulations email unless
//   send_congrats is false.
export const enrollStudents = async (req, res) => {
  const { school_year_id: yearId, from_school_year_id: fromId } = req.body || {};
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const sendEmails = req.body?.send_congrats !== false;

  if (entries.length === 0) {
    return res.status(400).json({ success: false, message: 'Choose at least one student.' });
  }
  // Each student can need up to 3 writes; Firestore batches hold 500.
  if (entries.length > 150) {
    return res.status(400).json({ success: false, message: 'Enroll at most 150 students at a time.' });
  }

  try {
    const year = await getSchoolYear(yearId);
    if (!year) return res.status(404).json({ success: false, message: 'That school year no longer exists.' });
    const fromYear = fromId ? await getSchoolYear(fromId) : null;
    if (fromId && !fromYear) return res.status(404).json({ success: false, message: 'The previous school year no longer exists.' });
    if (fromYear && fromYear.startYear >= year.startYear) {
      return res.status(400).json({ success: false, message: 'Students can only be retrieved from an earlier school year.' });
    }

    const enrolled = [];
    const graduated = [];
    const skipped = [];
    const congrats = [];
    const batch = db.batch();
    const now = new Date().toISOString();

    for (const entry of entries) {
      const uid = entry?.uid;
      const graduate = entry?.graduate === true;
      const grade = parseInt(entry?.grade_level, 10);
      if (!uid || (!graduate && !validGrade(grade))) { skipped.push({ uid, reason: 'Invalid grade level.' }); continue; }

      const userSnap = await db.collection('users').doc(uid).get();
      const student = userSnap.exists ? userSnap.data() : null;
      if (!student || student.role !== 'student') { skipped.push({ uid, reason: 'Student not found.' }); continue; }
      const name = student.full_name || uid;
      if (student.status === 'archived') { skipped.push({ uid, name, reason: 'Account is archived — restore it first.' }); continue; }

      const ref = db.collection('enrollments').doc(enrollmentId(year.id, uid));
      if ((await ref.get()).exists) { skipped.push({ uid, name, reason: `Already enrolled in S.Y. ${year.schoolYear}.` }); continue; }

      // ── Graduate: close the old year, don't enroll in the new one ──
      if (graduate) {
        if (!fromYear) { skipped.push({ uid, name, reason: 'Graduating needs the school year they finished.' }); continue; }
        const prevRef = db.collection('enrollments').doc(enrollmentId(fromYear.id, uid));
        const prevSnap = await prevRef.get();
        const prev = prevSnap.exists ? prevSnap.data() : null;
        if (!prev) { skipped.push({ uid, name, reason: `Not enrolled in S.Y. ${fromYear.schoolYear}.` }); continue; }
        if (parseInt(prev.grade_level, 10) !== 6) { skipped.push({ uid, name, reason: 'Only Grade 6 students can graduate.' }); continue; }
        if (prev.status === GRADUATED) { skipped.push({ uid, name, reason: 'Already graduated.' }); continue; }
        if (['transferred', 'dropped'].includes(prev.status)) {
          skipped.push({ uid, name, reason: `Marked ${prev.status} in S.Y. ${fromYear.schoolYear}.` }); continue;
        }
        batch.set(prevRef, {
          status: GRADUATED, status_changed_at: now, updated_at: now, updated_by: req.user.uid,
        }, { merge: true });
        batch.set(db.collection('users').doc(uid), {
          graduated_school_year: fromYear.schoolYear, graduated_at: now,
        }, { merge: true });
        graduated.push({ uid, name });
        if (sendEmails && !prev.congrats_sent_at) {
          congrats.push({
            enrollmentRef: prevRef, full_name: name, email: student.email, kind: 'graduated',
            fromGrade: 6, schoolYear: fromYear.schoolYear,
          });
        }
        continue;
      }

      batch.set(ref, enrollmentData({
        uid, student, year, grade, by: req.user.uid,
        retrievedFrom: fromYear ? fromYear.schoolYear : null,
      }));

      // One write to the account: the current grade (active year only) and,
      // for a Grade 6 who was marked graduated but is now retained, clearing
      // that mark — they are a student again. Kept to one write so a full
      // 150-student batch stays under Firestore's 500-write limit.
      const userUpdate = {};
      if (year.isActive) userUpdate.grade_level = String(grade);
      if (student.graduated_school_year) Object.assign(userUpdate, { graduated_school_year: null, graduated_at: null });
      if (Object.keys(userUpdate).length) batch.set(db.collection('users').doc(uid), userUpdate, { merge: true });

      if (fromYear) {
        const prevRef = db.collection('enrollments').doc(enrollmentId(fromYear.id, uid));
        const prev = await prevRef.get();
        if (prev.exists && prev.data().status === 'enrolled') {
          const prevGrade = parseInt(prev.data().grade_level, 10);
          const promoted = grade > prevGrade;
          batch.set(prevRef, {
            status: promoted ? 'promoted' : 'retained',
            status_changed_at: now,
            updated_at: now,
            updated_by: req.user.uid,
          }, { merge: true });
          if (promoted && sendEmails && !prev.data().congrats_sent_at) {
            congrats.push({
              enrollmentRef: prevRef, full_name: name, email: student.email, kind: 'promoted',
              fromGrade: prevGrade, toGrade: grade, schoolYear: fromYear.schoolYear, nextSchoolYear: year.schoolYear,
            });
          }
        }
      }
      enrolled.push({ uid, name, grade_level: String(grade) });
    }

    if (enrolled.length || graduated.length) await batch.commit();
    const emails = congrats.length ? await sendCongrats(congrats) : { sent: 0, failed: [] };
    return res.json({ success: true, schoolYear: year.schoolYear, enrolled, graduated, skipped, emails });
  } catch (err) {
    console.error('enrollStudents failed:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/enrollments/enroll-current ─────────────────────────────────────
// One-time catch-up: enroll every non-archived student who has no enrollment
// in this (active) year yet, keeping their current grade. Used when
// enrollments are first switched on, and for students added before then.
export const enrollCurrentStudents = async (req, res) => {
  try {
    const year = await getSchoolYear(req.body?.school_year_id);
    if (!year) return res.status(404).json({ success: false, message: 'That school year no longer exists.' });
    if (!year.isActive) return res.status(400).json({ success: false, message: 'Current students can only be enrolled into the active school year.' });

    const students = await db.collection('users').where('role', '==', 'student').get();
    const existing = await db.collection('enrollments').where('school_year_id', '==', year.id).get();
    const already = new Set(existing.docs.map((d) => d.data().student_id));
    // Students already enrolled in a later school year are left alone.
    const later = await db.collection('enrollments').where('start_year', '>', year.startYear).get();
    later.docs.forEach((d) => already.add(d.data().student_id));
    // So are students whose latest earlier enrollment ended for good
    // (graduated, transferred or dropped) — they aren't re-enrolled.
    const earlier = await db.collection('enrollments').where('start_year', '<', year.startYear).get();
    const latest = new Map();
    earlier.docs.forEach((d) => {
      const e = d.data();
      const prev = latest.get(e.student_id);
      if (!prev || Number(e.start_year) > Number(prev.start_year)) latest.set(e.student_id, e);
    });
    latest.forEach((e) => { if ([GRADUATED, 'transferred', 'dropped'].includes(e.status)) already.add(e.student_id); });

    // Graduates finished Grade 6 — they are not "missing" from a new year.
    const toEnroll = students.docs.filter((d) => d.data().status !== 'archived' && !d.data().graduated_school_year && !already.has(d.id));
    const skippedNoGrade = [];
    for (let i = 0; i < toEnroll.length; i += 450) {
      const batch = db.batch();
      toEnroll.slice(i, i + 450).forEach((d) => {
        const grade = parseInt(d.data().grade_level, 10);
        if (!validGrade(grade)) { skippedNoGrade.push(d.data().full_name || d.id); return; }
        batch.set(db.collection('enrollments').doc(enrollmentId(year.id, d.id)),
          enrollmentData({ uid: d.id, student: d.data(), year, grade, by: req.user.uid }));
      });
      await batch.commit();
    }
    return res.json({
      success: true,
      schoolYear: year.schoolYear,
      enrolled: toEnroll.length - skippedNoGrade.length,
      skippedNoGrade,
    });
  } catch (err) {
    console.error('enrollCurrentStudents failed:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/enrollments/:id ───────────────────────────────────────────────
// Update an enrollment's status (and optionally the grade for that year).
// Changing the status to "promoted" or graduated ("completed") emails the
// student a congratulations, once per enrollment, unless send_congrats is false.
export const updateEnrollment = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const hasGrade = req.body?.grade_level !== undefined && req.body?.grade_level !== null && req.body?.grade_level !== '';
  const grade = hasGrade ? parseInt(req.body.grade_level, 10) : null;

  if (status !== undefined && !ENROLLMENT_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Unknown enrollment status.' });
  }
  if (hasGrade && !validGrade(grade)) {
    return res.status(400).json({ success: false, message: 'Grade level must be between 1 and 6.' });
  }
  if (status === undefined && !hasGrade) {
    return res.status(400).json({ success: false, message: 'Nothing to update.' });
  }

  try {
    const ref = db.collection('enrollments').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, message: 'Enrollment not found.' });
    const current = snap.data();
    const now = new Date().toISOString();
    const statusChanged = status !== undefined && status !== current.status;
    const gradeThatYear = hasGrade ? grade : parseInt(current.grade_level, 10);

    if (statusChanged && status === GRADUATED && gradeThatYear !== 6) {
      return res.status(400).json({ success: false, message: 'Only Grade 6 students can graduate.' });
    }
    if (statusChanged && status === 'promoted' && gradeThatYear >= 6) {
      return res.status(400).json({ success: false, message: 'Grade 6 students graduate instead of being promoted.' });
    }

    const update = { updated_at: now, updated_by: req.user.uid };
    if (statusChanged) {
      update.status = status;
      update.status_changed_at = now;
    }
    if (hasGrade) update.grade_level = String(grade);

    const batch = db.batch();
    batch.set(ref, update, { merge: true });
    // Keep the account's graduated mark in step with this record.
    const userRef = db.collection('users').doc(current.student_id);
    if (statusChanged && status === GRADUATED) {
      batch.set(userRef, { graduated_school_year: current.school_year, graduated_at: now }, { merge: true });
    } else if (statusChanged && current.status === GRADUATED) {
      batch.set(userRef, { graduated_school_year: null, graduated_at: null }, { merge: true });
    }
    // Grade change in the active year keeps the student's current grade in step.
    if (hasGrade) {
      const year = await getSchoolYear(current.school_year_id);
      if (year?.isActive) batch.set(db.collection('users').doc(current.student_id), { grade_level: String(grade) }, { merge: true });
    }
    await batch.commit();

    // Congratulate on promotion / graduation (once per enrollment).
    let email = null;
    const wantsCongrats = statusChanged && ['promoted', GRADUATED].includes(status)
      && req.body?.send_congrats !== false && !current.congrats_sent_at;
    if (wantsCongrats) {
      const userSnap = await userRef.get();
      const student = userSnap.exists ? userSnap.data() : {};
      const graduatedNow = status === GRADUATED;
      const result = await sendCongrats([{
        enrollmentRef: ref,
        full_name: student.full_name || current.student_name,
        email: student.email || current.student_email,
        kind: graduatedNow ? 'graduated' : 'promoted',
        fromGrade: gradeThatYear,
        toGrade: graduatedNow ? null : Math.min(gradeThatYear + 1, 6),
        schoolYear: current.school_year,
      }]);
      email = result.sent ? { sent: true } : { sent: false, reason: result.failed[0]?.reason };
    }
    return res.json({ success: true, message: 'Enrollment updated.', email });
  } catch (err) {
    console.error('updateEnrollment failed:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
