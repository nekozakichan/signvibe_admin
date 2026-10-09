import {
  createAuthUser,
  setFirestoreDocument,
  listFirestoreDocuments,
  archiveUserRecord,
  restoreUserRecord,
} from '../services/firebaseService.js';
import { sendStudentCredentials, sendAccountArchivedEmail } from '../services/mailerService.js';
import { encryptPassword, decryptPassword } from '../services/credentialVault.js';

// Archive reasons are emailed and shown in the Archived tab — keep them short.
const MAX_ARCHIVE_REASON = 500;

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

/**
 * Normalise a Philippine mobile number to 09XXXXXXXXX. Accepts the common ways
 * people type one — 09171234567, 0917 123 4567, 0917-123-4567, +639171234567,
 * 639171234567 — and returns null for anything that isn't a PH mobile number.
 */
function normalizePhMobile(raw) {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/[\s\-().]/g, '').replace(/^\+/, '');
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return '0' + digits.slice(2);
  return null;
}

function buildFullName(first_name, middle_name, last_name) {
  return [first_name, middle_name, last_name].filter((p) => p && p.trim()).join(' ').trim();
}

// ─── POST /api/students — Create account only, do NOT auto-email ──────────────
export const createStudent = async (req, res) => {
  const { first_name, middle_name, last_name, email, grade_level, parent_contact } = req.body;

  if (!first_name || !last_name || !email || !grade_level || !parent_contact) {
    return res.status(400).json({
      success: false,
      message: 'first_name, last_name, email, grade_level, and parent_contact are required.',
    });
  }

  const parentContact = normalizePhMobile(parent_contact);
  if (!parentContact) {
    return res.status(400).json({
      success: false,
      message: "Parent's contact number must be a valid PH mobile number, e.g. 09171234567.",
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
      parent_contact: parentContact,
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

    // The password is never sent back to the browser — it would show up in the
    // network tab and in any logged response. It reaches the student only
    // through "Send Credentials", straight from the vault to their Gmail.
    return res.status(201).json({
      success: true,
      message: 'Student account created successfully.',
      uid,
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
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) {
    return res.status(400).json({ success: false, message: 'Please give a reason for archiving this account.' });
  }
  if (reason.length > MAX_ARCHIVE_REASON) {
    return res.status(400).json({ success: false, message: `Keep the reason under ${MAX_ARCHIVE_REASON} characters.` });
  }
  try {
    const { db } = await import('../config/firebase.js');
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    const { email, full_name, first_name, middle_name, last_name } = doc.data();
    const name = full_name || buildFullName(first_name, middle_name, last_name);

    await archiveUserRecord(uid, reason);

    // The archive has already happened; a failed email shouldn't undo it or
    // report it as failed. Say so instead, so the sender can follow up.
    try {
      await sendAccountArchivedEmail({ full_name: name, email, reason, role: 'student' });
    } catch (mailErr) {
      return res.json({
        success: true,
        emailSent: false,
        message: `Student archived, but the email to ${email} could not be sent: ${mailErr.message}`,
      });
    }
    return res.json({ success: true, emailSent: true, message: `Student archived. The reason was emailed to ${email}.` });
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
