/**
 * Clean up Firestore records whose uploaded file was deleted from Firebase Storage.
 *
 * Looks at every lesson video, quiz-question video and module icon, checks whether
 * the file still exists in Storage, and removes the records that point at a missing file:
 *
 *   lessons         -> deleted when its video file is gone
 *   quiz_questions  -> deleted when its video file is gone
 *   modules         -> deleted when its icon file is gone AND all of its lessons are
 *                      being deleted too (or it has none). If the module still has
 *                      lessons with working videos, only the broken icon_url is cleared.
 *
 * Records that still have a working file are never touched. student_progress is never
 * touched either — it is only counted, so you know what will show "Lesson <id>".
 *
 * Run from the backend folder on your own machine:
 *
 *   cd backend
 *   node scripts/cleanup-missing-media.js            # preview only, changes nothing
 *   node scripts/cleanup-missing-media.js --apply    # actually delete
 *
 * To also remove specific modules even though their files still exist (their lessons,
 * quiz questions, and the module's own icon/video files in Storage go with them):
 *
 *   node scripts/cleanup-missing-media.js --modules "Alphabet,Numbers"           # preview
 *   node scripts/cleanup-missing-media.js --modules "Alphabet,Numbers" --apply   # delete
 */

import '../src/loadEnv.js';
import { db, bucket } from '../src/config/firebase.js';

const apply = process.argv.includes('--apply');
const moduleIdOf = (name = '') => name.toLowerCase().replace(/\s/g, '_');
const modulesArgIdx = process.argv.indexOf('--modules');
const forcedModuleIds = new Set(
  modulesArgIdx > -1 && process.argv[modulesArgIdx + 1]
    ? process.argv[modulesArgIdx + 1].split(',').map((n) => moduleIdOf(n.trim())).filter(Boolean)
    : []
);

// Firebase download URL -> storage object path ("lesson-videos/abc.mp4")
function storagePathOf(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    if (url.startsWith('gs://')) return url.replace(/^gs:\/\/[^/]+\//, '');
    const m = new URL(url).pathname.match(/\/o\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

async function deleteInBatches(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

async function main() {
  console.log(apply ? '=== APPLY MODE: records will be deleted ===\n' : '=== PREVIEW (nothing is changed) — add --apply to delete ===\n');

  const [files] = await bucket.getFiles();
  const existing = new Set(files.map((f) => f.name));
  console.log(`Storage bucket ${bucket.name}: ${files.length} file(s) still present.\n`);

  const isMissing = (url) => {
    const p = storagePathOf(url);
    return p !== null && !existing.has(p);
  };

  const [modSnap, lessonSnap, quizSnap] = await Promise.all([
    db.collection('modules').get(),
    db.collection('lessons').get(),
    db.collection('quiz_questions').get(),
  ]);

  // ---- Lessons
  const lessonsByModule = {};
  const lessonsToDelete = [];
  let lessonsKept = 0;
  lessonSnap.forEach((d) => {
    const l = d.data();
    (lessonsByModule[l.module_id] ||= []).push(d);
    if (isMissing(l.video_url) || forcedModuleIds.has(l.module_id)) lessonsToDelete.push(d);
    else lessonsKept++;
  });
  const deletingLessonIds = new Set(lessonsToDelete.map((d) => d.id));

  console.log(`LESSONS — ${lessonsToDelete.length} to delete, ${lessonsKept} kept`);
  const perModule = {};
  lessonsToDelete.forEach((d) => {
    const k = d.data().module_title || d.data().module_id || '(no module)';
    perModule[k] = (perModule[k] || 0) + 1;
  });
  Object.entries(perModule).forEach(([k, n]) => console.log(`   ${k}: ${n}`));

  // ---- Quiz questions
  const quizToDelete = [];
  quizSnap.forEach((d) => {
    const q = d.data();
    if (isMissing(q.video_url) || forcedModuleIds.has(q.module_id)) quizToDelete.push(d);
  });
  console.log(`\nQUIZ QUESTIONS — ${quizToDelete.length} to delete, ${quizSnap.size - quizToDelete.length} kept`);

  // ---- Modules
  const modulesToDelete = [];
  const modulesToClearIcon = [];
  modSnap.forEach((d) => {
    const m = d.data();
    if (forcedModuleIds.has(moduleIdOf(m.name))) { modulesToDelete.push(d); return; }
    if (!isMissing(m.icon_url)) return;
    const lessons = lessonsByModule[moduleIdOf(m.name)] || [];
    const allGoing = lessons.every((l) => deletingLessonIds.has(l.id));
    (allGoing ? modulesToDelete : modulesToClearIcon).push(d);
  });
  console.log(`\nMODULES — ${modulesToDelete.length} to delete, ${modulesToClearIcon.length} to keep but clear broken icon, ${modSnap.size - modulesToDelete.length - modulesToClearIcon.length} untouched`);
  modulesToDelete.forEach((d) => console.log(`   delete:      ${d.data().name}`));
  modulesToClearIcon.forEach((d) => console.log(`   clear icon:  ${d.data().name} (still has lessons with working videos)`));
  modSnap.forEach((d) => {
    if (![...modulesToDelete, ...modulesToClearIcon].some((x) => x.id === d.id)) console.log(`   untouched:   ${d.data().name}`);
  });

  // ---- student_progress (counted only)
  let progressRefs = 0;
  if (deletingLessonIds.size) {
    const progSnap = await db.collection('student_progress').get();
    progSnap.forEach((d) => { if (deletingLessonIds.has(d.data().lesson_id)) progressRefs++; });
  }
  console.log(`\nstudent_progress records pointing at deleted lessons: ${progressRefs} (left as-is)`);

  // Files that still exist in Storage but belong to records being deleted
  // (only happens for --modules). A video still used by a kept quiz question is spared.
  const keptQuizPaths = new Set();
  quizSnap.forEach((d) => {
    if (!quizToDelete.some((x) => x.id === d.id)) keptQuizPaths.add(storagePathOf(d.data().video_url));
  });
  const storageToDelete = [...new Set(
    [...lessonsToDelete, ...quizToDelete].map((d) => storagePathOf(d.data().video_url))
      .concat(modulesToDelete.map((d) => storagePathOf(d.data().icon_url)))
      .filter((p) => p && existing.has(p) && !keptQuizPaths.has(p))
  )];
  console.log(`Storage files that will also be removed: ${storageToDelete.length}`);

  if (!apply) {
    console.log('\nPreview only. Re-run with --apply to delete the records above.');
    return;
  }

  await deleteInBatches([...lessonsToDelete, ...quizToDelete, ...modulesToDelete].map((d) => d.ref));
  for (const p of storageToDelete) {
    try { await bucket.file(p).delete(); } catch { /* already gone */ }
  }
  for (const d of modulesToClearIcon) await d.ref.update({ icon_url: null });

  console.log(`\nDone. Deleted ${lessonsToDelete.length} lesson(s), ${quizToDelete.length} quiz question(s), ${modulesToDelete.length} module(s); cleared ${modulesToClearIcon.length} icon(s).`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
