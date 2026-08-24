import { generatePasswordResetLink } from '../services/firebaseService.js';
import { sendPasswordResetEmail } from '../services/mailerService.js';

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
