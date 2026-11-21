/**
 * Reset student progress for a fresh start (e.g. after re-uploading modules).
 *
 * Erases, for every student:
 *   student_progress  -> completed lessons / module progress
 *   quiz_results      -> quiz scores and stars
 *   game_sessions     -> Memory Match sessions only (docs with game_type containing
 *                        "memory", or with moves/pairs fields). Other games are kept.
 *
 * Not touched: users, modules, lessons, quiz_questions, leaderboard (Flappy Sign).
 *
 * Before deleting, a full JSON backup of every removed doc is written to
 * backend/scripts/backups/ so it can be restored if needed.
 *
 * Run from the backend folder on your own machine:
 *
 *   cd backend
 *   node scripts/reset-student-progress.js                  # preview, changes nothing
 *   node scripts/reset-student-progress.js --apply          # back up, then delete
 *   node scripts/reset-student-progress.js --student <uid>  # limit to one student
 */

import '../src/loadEnv.js';
import { db } from '../src/config/firebase.js';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const apply = process.argv.includes('--apply');
const studentIdx = process.argv.indexOf('--student');
const onlyStudent = studentIdx > -1 ? process.argv[studentIdx + 1] : null;

const isMemoryMatch = (g) =>
  (typeof g.game_type === 'string' && g.game_type.toLowerCase().includes('memory')) ||
  (!g.game_type && (g.moves !== undefined || g.pairs !== undefined));

async function fetchAll(name) {
  let q = db.collection(name);
  if (onlyStudent) q = q.where('student_id', '==', onlyStudent);
  return (await q.get()).docs;
}

async function deleteInBatches(docs) {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

// Firestore Timestamps -> ISO strings so the backup is readable JSON
const plain = (v) => {
  if (v && typeof v.toDate === 'function') return { __timestamp: v.toDate().toISOString() };
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
};

async function main() {
  console.log(apply ? '=== APPLY MODE: progress will be deleted ===' : '=== PREVIEW (nothing is changed) — add --apply to delete ===');
  console.log(onlyStudent ? `Scope: student ${onlyStudent}\n` : 'Scope: ALL students\n');

  const [progress, quiz, sessions] = await Promise.all([
    fetchAll('student_progress'),
    fetchAll('quiz_results'),
    fetchAll('game_sessions'),
  ]);

  const memory = sessions.filter((d) => isMemoryMatch(d.data()));
  const otherGames = {};
  sessions.filter((d) => !isMemoryMatch(d.data())).forEach((d) => {
    const t = d.data().game_type || '(unknown)';
    otherGames[t] = (otherGames[t] || 0) + 1;
  });

  const students = new Set([...progress, ...quiz, ...memory].map((d) => d.data().student_id));
  console.log(`student_progress (lessons/modules): ${progress.length}`);
  console.log(`quiz_results     (quizzes):         ${quiz.length}`);
  console.log(`game_sessions    (Memory Match):    ${memory.length}`);
  console.log(`Students affected: ${students.size}`);
  if (Object.keys(otherGames).length) console.log('Other game sessions kept:', otherGames);

  if (!apply) {
    console.log('\nPreview only. Re-run with --apply to back up and delete.');
    return;
  }

  const dir = join(dirname(fileURLToPath(import.meta.url)), 'backups');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `progress-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const dump = (docs) => docs.map((d) => ({ id: d.id, data: plain(d.data()) }));
  writeFileSync(file, JSON.stringify({
    created_at: new Date().toISOString(),
    scope: onlyStudent || 'all',
    student_progress: dump(progress),
    quiz_results: dump(quiz),
    game_sessions: dump(memory),
  }, null, 2));
  console.log(`\nBackup written: ${file}`);

  await deleteInBatches([...progress, ...quiz, ...memory]);
  console.log(`Done. Deleted ${progress.length} progress, ${quiz.length} quiz result, ${memory.length} Memory Match doc(s).`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
