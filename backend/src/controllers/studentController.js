import {
  createAuthUser,
  setFirestoreDocument,
  listFirestoreDocuments,
  archiveUserRecord,
  restoreUserRecord,
} from '../services/firebaseService.js';
import { sendStudentCredentials } from '../services/mailerService.js';

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  return Array.from({ length: 10 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
}

function buildFullName(first_name, middle_name, last_name) {
  return [first_name, middle_name, last_name].filter((p) => p && p.trim()).join(' ').trim();
}

// ─── POST /api/students — Create account only, do NOT auto-email ──────────────
export const createStudent = async (req, res) => {
  const { first_name, middle_name, last_name, email, grade_level, section } = req.body;

  if (!first_name || !last_name || !email || !grade_level || !section) {
    return res.status(400).json({
      success: false,
      message: 'first_name, last_name, email, grade_level, and section are required.',
    });
  }

  const grade = parseInt(grade_level);
  if (isNaN(grade) || grade < 1 || grade > 6) {
    return res.status(400).json({ success: false, message: 'grade_level must be between 1 and 6.' });
  }

  const full_name = buildFullName(first_name, middle_name, last_name);
  const password = generatePassword();

  try {
    const uid = await createAuthUser(email, password, full_name);

    // Save the password in Firestore so admin can send it via "Send Credentials" anytime
    await setFirestoreDocument('users', uid, {
      first_name,
      middle_name: middle_name || '',
      last_name,
      full_name,
      email,
      role: 'student',
      status: 'active',
      grade_level: String(grade_level),
      section,
      lessons_completed: 0,
      total_points: 0,
      account_password: password, // stored so admin can email it anytime
      created_at: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      message: 'Student account created successfully.',
      uid,
      generatedPassword: password,
    });
  } catch (err) {
    const message = err.message || 'Unknown error';
    if (message.includes('email-already-exists')) {
      return res.status(409).json({ success: false, message: 'This email is already registered.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create student: ' + message });
  }
};

// ─── GET /api/students ────────────────────────────────────────────────────────
// Returns both active and archived students; the frontend splits them into tabs.
export const getStudents = async (req, res) => {
  try {
    const students = await listFirestoreDocuments('users', [
      { field: 'role', op: '==', value: 'student' },
    ]);
    return res.json({ success: true, data: students });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/students/:uid/status ─────────────────────────────────────────
export const toggleStudentStatus = async (req, res) => {
  const { uid } = req.params;
  const { status } = req.body;
  if (!['active', 'deactivated'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be active or deactivated.' });
  }
  try {
    const { setUserDisabled } = await import('../services/firebaseService.js');
    await setUserDisabled(uid, status === 'deactivated');
    await setFirestoreDocument('users', uid, { status });
    return res.json({ success: true, message: 'Student status updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/students/:uid/archive ─────────────────────────────────────────
// Replaces permanent deletion. Disables the Auth account and flags the
// Firestore record as archived so progress/history data is preserved.
export const archiveStudent = async (req, res) => {
  const { uid } = req.params;
  try {
    await archiveUserRecord(uid);
    return res.json({ success: true, message: 'Student archived.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/students/:uid/restore ─────────────────────────────────────────
export const restoreStudent = async (req, res) => {
  const { uid } = req.params;
  try {
    await restoreUserRecord(uid);
    return res.json({ success: true, message: 'Student restored.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/students/:uid/send-credentials ─────────────────────────────────
// Admin manually sends username + password to student's Gmail
export const sendStudentCredentialsEmail = async (req, res) => {
  const { uid } = req.params;
  try {
    const { db } = await import('../config/firebase.js');
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const { email, full_name, grade_level, section, account_password } = doc.data();

    if (!account_password) {
      return res.status(400).json({
        success: false,
        message: 'No password stored for this student.',
      });
    }

    await sendStudentCredentials({
      full_name,
      email,
      password: account_password,
      grade_level,
      section,
    });

    return res.json({
      success: true,
      message: `Username and password sent to ${email} successfully.`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
