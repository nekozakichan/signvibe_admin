import { auth, db } from '../config/firebase.js';
import dotenv from 'dotenv';
dotenv.config();

export const createAuthUser = async (email, password, displayName) => {
  const user = await auth.createUser({
    email,
    password,
    displayName,
    emailVerified: false,
    disabled: false,
  });
  return user.uid;
};

export const setFirestoreDocument = async (collection, documentId, data) => {
  await db.collection(collection).doc(documentId).set(data, { merge: true });
};

export const listFirestoreDocuments = async (collection, filters = []) => {
  let ref = db.collection(collection);
  filters.forEach(({ field, op, value }) => {
    ref = ref.where(field, op, value);
  });
  const snap = await ref.get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const setUserDisabled = async (uid, disabled) => {
  await auth.updateUser(uid, { disabled });
};

// ─── Archive a user: disable their Auth account + mark the Firestore record ───
// This replaces hard-deletion so records (and any related history/progress
// data linked by uid) are preserved instead of being destroyed.
export const archiveUserRecord = async (uid) => {
  await setUserDisabled(uid, true);
  await setFirestoreDocument('users', uid, {
    status: 'archived',
    archived_at: new Date().toISOString(),
  });
};

// ─── Restore a previously archived user ────────────────────────────────────
export const restoreUserRecord = async (uid) => {
  await setUserDisabled(uid, false);
  await setFirestoreDocument('users', uid, {
    status: 'active',
    archived_at: null,
    restored_at: new Date().toISOString(),
  });
};

// ─── Generate password reset link with proper actionCodeSettings ──────────────
export const generatePasswordResetLink = async (email) => {
  const actionCodeSettings = {
    url: process.env.APP_URL || 'http://localhost:5173',
    handleCodeInApp: false,
  };
  const link = await auth.generatePasswordResetLink(email, actionCodeSettings);
  return link;
};
