import {
  createAuthUser,
  setFirestoreDocument,
  listFirestoreDocuments,
  archiveUserRecord,
  restoreUserRecord,
} from '../services/firebaseService.js';
import { sendTeacherCredentials } from '../services/mailerService.js';
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

// ─── POST /api/teachers ───────────────────────────────────────────────────────
export const createTeacher = async (req, res) => {
  const { first_name, middle_name, last_name, email, employee_no } = req.body;

  if (!first_name || !last_name || !email || !employee_no) {
    return res.status(400).json({
      success: false,
      message: 'first_name, last_name, email, and employee_no are required.',
    });
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
      role: 'teacher',
      status: 'active',
      employee_no,
      created_at: new Date().toISOString(),
    });

    // Encrypted, in a collection no client can read — never on the users doc.
    await setFirestoreDocument('user_credentials', uid, {
      password_enc: encryptPassword(password),
      updated_at: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      message: 'Teacher account created successfully.',
      uid,
      generatedPassword: password,
    });
  } catch (err) {
    const message = err.message || 'Unknown error';
    if (message.includes('email-already-exists')) {
      return res.status(409).json({ success: false, message: 'This email is already registered.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create teacher account: ' + message });
  }
};

// ─── GET /api/teachers ────────────────────────────────────────────────────────
// Returns both active and archived teachers; the frontend splits them into tabs.
export const getTeachers = async (req, res) => {
  try {
    const teachers = await listFirestoreDocuments('users', [
      { field: 'role', op: '==', value: 'teacher' },
    ]);
    return res.json({ success: true, data: teachers });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/teachers/:uid/status ─────────────────────────────────────────
export const toggleTeacherStatus = async (req, res) => {
  const { uid } = req.params;
  const { status } = req.body;
  if (!['active', 'deactivated'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be active or deactivated.' });
  }
  try {
    const { setUserDisabled } = await import('../services/firebaseService.js');
    await setUserDisabled(uid, status === 'deactivated');
    await setFirestoreDocument('users', uid, { status });
    return res.json({ success: true, message: 'Teacher status updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/teachers/:uid/archive ─────────────────────────────────────────
// Replaces permanent deletion. Disables the Auth account and flags the
// Firestore record as archived so the record (and any linked data) is kept.
export const archiveTeacher = async (req, res) => {
  const { uid } = req.params;
  try {
    await archiveUserRecord(uid);
    return res.json({ success: true, message: 'Teacher archived.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/teachers/:uid/restore ─────────────────────────────────────────
export const restoreTeacher = async (req, res) => {
  const { uid } = req.params;
  try {
    await restoreUserRecord(uid);
    return res.json({ success: true, message: 'Teacher restored.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/teachers/:uid/send-credentials ────────────────────────────────
export const sendTeacherCredentialsEmail = async (req, res) => {
  const { uid } = req.params;
  try {
    const { db } = await import('../config/firebase.js');
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Teacher not found.' });
    }
    const { email, full_name, employee_no } = doc.data();
    const { password, resetAt } = await readStoredCredential(db, uid, doc.data());
    if (!password) {
      return res.status(400).json({
        success: false,
        message: resetAt ? RESET_NOTICE : 'No stored password found for this account.',
      });
    }
    await sendTeacherCredentials({ full_name, email, password, employee_no });
    return res.json({ success: true, message: `Credentials sent to ${email}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
