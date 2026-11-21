/**
 * One-time cleanup after the Deactivate button was removed from Manage Teachers.
 *
 * Any teacher still marked "deactivated" would be locked out with no button to
 * turn them back on. This finds those teachers, turns their login back on and
 * sets their status to "active". Archived teachers are not touched.
 *
 * Run from the backend folder on your own machine:
 *
 *   cd backend
 *   node scripts/reactivate-deactivated-teachers.js           # preview only, changes nothing
 *   node scripts/reactivate-deactivated-teachers.js --apply   # actually reactivate
 */

import '../src/loadEnv.js';
import { auth, db } from '../src/config/firebase.js';

const apply = process.argv.includes('--apply');

const snap = await db.collection('users').where('role', '==', 'teacher').get();
const stuck = snap.docs.filter((d) => {
  const status = d.data().status;
  return status && status !== 'active' && status !== 'archived';
});

if (stuck.length === 0) {
  console.log('No deactivated teachers found. Nothing to do.');
  process.exit(0);
}

console.log(`${stuck.length} deactivated teacher(s):`);
for (const d of stuck) console.log(`  - ${d.data().full_name || '(no name)'} <${d.data().email}>`);

if (!apply) {
  console.log('\nPreview only. Run again with --apply to reactivate them.');
  process.exit(0);
}

for (const d of stuck) {
  await auth.updateUser(d.id, { disabled: false });
  await d.ref.set({ status: 'active' }, { merge: true });
  console.log(`  Reactivated ${d.data().email}`);
}
console.log('Done.');
process.exit(0);
