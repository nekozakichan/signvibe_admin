import { auth, db } from '../config/firebase.js';

/**
 * Only let a signed-in user with one of these roles through.
 *
 * The browser sends its Firebase ID token as "Authorization: Bearer <token>".
 * We verify it with Firebase (so it can't be forged), then look up the caller's
 * role on their users/{uid} document. The verified caller is left on
 * req.user = { uid, role, email } for the handler.
 */
export function requireRole(...roles) {
  return async (req, res, next) => {
    const header = req.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Please log in again.' });
    }
    try {
      const decoded = await auth.verifyIdToken(token);
      const snap = await db.collection('users').doc(decoded.uid).get();
      const role = snap.exists ? snap.data().role : null;
      if (!roles.includes(role)) {
        return res.status(403).json({ success: false, message: 'You are not allowed to do this.' });
      }
      req.user = { uid: decoded.uid, role, email: decoded.email };
      return next();
    } catch {
      return res.status(401).json({ success: false, message: 'Your session has expired. Please log in again.' });
    }
  };
}
