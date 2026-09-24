import {
  generatePasswordResetLink,
  getUidByEmail,
  markPasswordReset,
} from '../services/firebaseService.js';
import { sendPasswordResetEmail } from '../services/mailerService.js';
import { FieldValue } from 'firebase-admin/firestore';

// ─── POST /api/reset-requests ────────────────────────────────────────────────
// Called by the public Forgot Password page, which has no signed-in user. The
// lookup and the write both happen here, through the Admin SDK, so the browser
// never needs read access to the users collection.
export const createResetRequest = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required.' });
  }

  try {
    const { db } = await import('../config/firebase.js');

    const userSnap = await db
      .collection('users')
      .where('email', '==', email)
      .where('role', '==', 'teacher')
      .limit(1)
      .get();

    if (userSnap.empty) {
      return res.status(404).json({
        success: false,
        message: 'No teacher account found with this email address.',
      });
    }

    const teacherDoc = userSnap.docs[0];
    const { full_name } = teacherDoc.data();

    const pendingSnap = await db
      .collection('password_reset_requests')
      .where('email', '==', email)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!pendingSnap.empty) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending reset request. Please wait for the admin to process it.',
      });
    }

    await db.collection('password_reset_requests').add({
      teacher_uid: teacherDoc.id,
      full_name: full_name || '',
      email,
      status: 'pending',
      requested_at: FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ success: true, message: 'Reset request submitted.' });
  } catch (err) {
    console.error('createResetRequest error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not submit the request.' });
  }
};

// ─── GET /api/reset-requests ──────────────────────────────────────────────────
export const getResetRequests = async (req, res) => {
  try {
    const { db } = await import('../config/firebase.js');
    const snap = await db
      .collection('password_reset_requests')
      .where('status', '==', 'pending')
      .get();

    const requests = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const aTime = a.requested_at?.toDate?.() || new Date(a.requested_at || 0);
        const bTime = b.requested_at?.toDate?.() || new Date(b.requested_at || 0);
        return bTime - aTime;
      });

    return res.json({ success: true, data: requests });
  } catch (err) {
    console.error('getResetRequests error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/reset-requests/:id/send ───────────────────────────────────────
export const sendResetLink = async (req, res) => {
  const { id } = req.params;
  try {
    const { db } = await import('../config/firebase.js');
    const requestDoc = await db.collection('password_reset_requests').doc(id).get();

    if (!requestDoc.exists) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const { email, full_name } = requestDoc.data();

    // Generate reset link — actionCodeSettings is handled inside firebaseService
    const reset_link = await generatePasswordResetLink(email);

    // Email the link to the teacher
    await sendPasswordResetEmail({ full_name, email, reset_link });

    // The stored password is about to stop being the real one — the user will
    // choose their own through the link. Drop it so "Send Credentials" can't
    // email a password that no longer works. Best-effort: if this fails the
    // reset link has already gone out, and blocking on it would be worse.
    try {
      const uid = await getUidByEmail(email);
      await markPasswordReset(uid);
    } catch (vaultErr) {
      console.error('Could not clear stored password for', email, '—', vaultErr.message);
    }

    // Mark as sent
    await db.collection('password_reset_requests').doc(id).update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: `Password reset link sent to ${email}.`,
    });
  } catch (err) {
    console.error('sendResetLink error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/reset-requests/:id/dismiss ───────────────────────────────────
export const dismissResetRequest = async (req, res) => {
  const { id } = req.params;
  try {
    const { db } = await import('../config/firebase.js');
    await db.collection('password_reset_requests').doc(id).update({
      status: 'dismissed',
    });
    return res.json({ success: true, message: 'Request dismissed.' });
  } catch (err) {
    console.error('dismissResetRequest error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
