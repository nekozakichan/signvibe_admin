import {
  createAuthUser,
  setFirestoreDocument,
  listFirestoreDocuments,
  archiveUserRecord,
  restoreUserRecord,
} from '../services/firebaseService.js';
import { sendStudentCredentials } from '../services/mailerService.js';
import { encryptPassword, decryptPassword } from '../services/credentialVault.js';

/**
 * Where a generated password lives now: encrypted, in user_credentials/{uid},
 * a collection no client can read (see firestore.rules). Accounts created
 * before the vault existed still have plaintext on the users doc, so fall back
 * to that until scripts/migrate-credentials.js has been run.
 */
async function readStoredCredential(db, uid, legacyDoc) {
  const vaultDoc = await db.collection('user_credentials').doc(uid).get();
  if (vaultDoc.exists) {
    const data = vaultDoc.data() || {};
    if (data.password_enc) {
      return { password: decryptPassword(data.password_enc), resetAt: null };
    }
    // Cleared because a reset link was sent — the user set their own password.
    if (data.password_reset_at) {
      return { password: null, resetAt: data.password_reset_at };
    }
  }
  return { password: legacyDoc?.account_password || null, resetAt: null };
}

const RESET_NOTICE =
  'This account set its own password through a reset link, so the original is no longer ' +
  'valid. Send a new password reset link instead.';


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
  const { first_name, middle_name, last_name, email, grade_level } = req.body;

  if (!first_name || !last_name || !email || !grade_level) {
    return res.status(400).json({
      success: false,
      message: 'first_name, last_name, email, and grade_level are required.',
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

    await setFirestoreDocument('users', uid, {
      first_name,
      middle_name: middle_name || '',
      last_name,
      full_name,
      email,
      role: 'student',
      status: 'active',
      grade_level: String(grade_level),
      lessons_completed: 0,
      total_points: 0,
      created_at: new Date().toISOString(),
    });

    // The password itself never touches the users document — it goes to the
    // vault, encrypted, so "Send Credentials" can still reach it later.
    await setFirestoreDocument('user_credentials', uid, {
      password_enc: encryptPassword(password),
      updated_at: new Date().toISOString(),
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

    const { email, full_name, grade_level } = doc.data();
    const { password, resetAt } = await readStoredCredential(db, uid, doc.data());

    if (!password) {
      return res.status(400).json({
        success: false,
        message: resetAt ? RESET_NOTICE : 'No password stored for this student.',
      });
    }

    await sendStudentCredentials({
      full_name,
      email,
      password,
      grade_level,
    });

    return res.json({
      success: true,
      message: `Username and password sent to ${email} successfully.`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
