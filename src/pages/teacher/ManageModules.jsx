import { useState, useEffect, useCallback } from 'react';
import { db, storage } from '../../api/firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  query,
  where,
  deleteField,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';

// Max icon upload size, to keep Storage usage sane for small square icons
const MAX_ICON_SIZE_MB = 2;

// Modules that use the tracing quiz (auto-built), so they get NO authored quiz.
const TRACING_MODULE_IDS = ['alphabet', 'numbers'];
const moduleIdOf = (name) => (name || '').toLowerCase().replace(/\s/g, '_');

// ─── Add / Edit Module Modal ───────────────────────────────────────────────────
function ModuleFormModal({ initial, nextOrder, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    order: initial?.order ?? nextOrder,
  });
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(initial?.icon_url || null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [error, setError] = useState('');

  const handleIconChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, SVG, etc.)');
      return;
    }
    if (file.size > MAX_ICON_SIZE_MB * 1024 * 1024) {
      setError(`Icon image must be under ${MAX_ICON_SIZE_MB}MB.`);
      return;
    }
    setError('');
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
    setRemoveIcon(false);
  };

  const handleRemoveIcon = () => {
    setIconFile(null);
    setIconPreview(null);
    setRemoveIcon(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { setError('Module name is required.'); return; }
    setError('');
    onSave({ ...form, iconFile, removeIcon });
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: 16, padding: 28, zIndex: 1070, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div className="d-flex justify-content-between align-items-start mb-3">
          <h5 className="fw-bold mb-0" style={{ color: '#00838A' }}>
            <i className="bi bi-collection-fill me-2"></i>{initial ? 'Edit Module' : 'Add Module'}
          </h5>
          <button className="btn-close" onClick={onClose}></button>
        </div>
        {error && <div className="alert alert-danger py-2 small rounded-3 mb-3">{error}</div>}
        <div className="mb-3">
          <label className="form-label small fw-medium">Module Name</label>
          <input
            type="text"
            className="form-control rounded-3"
            placeholder="e.g. Family Members"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="mb-3">
          <label className="form-label small fw-medium">Module Icon <span style={{ color: '#777', fontSize: 11 }}>(optional — upload an image)</span></label>
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: 56, height: 56, backgroundColor: '#f0fafa', border: '1px solid #b2dfdb', overflow: 'hidden' }}
            >
              {iconPreview ? (
                <img src={iconPreview} alt="Module icon preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <i className="bi bi-image" style={{ color: '#9ecece', fontSize: 22 }}></i>
              )}
            </div>
            <div className="flex-fill">
              <input
                type="file"
                accept="image/*"
                className="form-control form-control-sm rounded-3"
                onChange={handleIconChange}
              />
              {iconPreview && (
                <button type="button" className="btn btn-sm btn-link text-danger p-0 mt-1" onClick={handleRemoveIcon}>
                  <i className="bi bi-x-circle me-1"></i>Remove icon
                </button>
              )}
            </div>
          </div>
          <small style={{ color: '#666' }}>PNG, JPG, or SVG, up to {MAX_ICON_SIZE_MB}MB. If left empty, a default icon is shown.</small>
        </div>
        <div className="mb-4">
          <label className="form-label small fw-medium">Display Order</label>
          <input
            type="number"
            min={1}
            className="form-control rounded-3"
            value={form.order}
            onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
          />
          <small style={{ color: '#666' }}>Lower numbers appear first in the module list.</small>
        </div>
        <div className="d-flex gap-2">
          <button className="btn flex-fill rounded-3 fw-medium text-white" style={{ backgroundColor: '#00838A' }} onClick={handleSubmit} disabled={saving}>
            {saving ? <span className="spinner-border spinner-border-sm"></span> : (initial ? 'Save Changes' : 'Add Module')}
          </button>
          <button className="btn btn-outline-secondary rounded-3" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </div>
    </>
  );
}

// ─── Quiz Question Form (add / edit one question) ──────────────────────────────
function QuizQuestionForm({ moduleId, moduleLessons, initial, nextOrder, onCancel, onSaved }) {
  const { currentUser } = useAuth();
  const [correct, setCorrect] = useState(initial?.correct_answer || '');
  const [wrong, setWrong] = useState(() => {
    const others = (initial?.choices || []).filter((c) => c !== initial?.correct_answer);
    return [others[0] || '', others[1] || '', others[2] || ''];
  });
  const [order, setOrder] = useState(initial?.order ?? nextOrder);

  // Video source: 'upload' a new file, or 'reuse' an existing lesson video.
  const [videoMode, setVideoMode] = useState(initial?.owns_video === false ? 'reuse' : 'upload');
  const [videoFile, setVideoFile] = useState(null);
  const [reuseUrl, setReuseUrl] = useState(
    initial && initial.owns_video === false ? initial.video_url : ''
  );

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const setWrongAt = (i, val) => setWrong((w) => w.map((x, idx) => (idx === i ? val : x)));

  const handleSubmit = async () => {
    if (!correct.trim()) { setError('Correct answer is required.'); return; }
    if (wrong.some((w) => !w.trim())) { setError('All 3 wrong answers are required.'); return; }
    if (videoMode === 'upload' && !videoFile && !initial?.video_url) {
      setError('Please upload a sign video.'); return;
    }
    if (videoMode === 'reuse' && !reuseUrl) { setError('Please choose a lesson video.'); return; }

    setSaving(true);
    setError('');
    try {
      let video_url = initial?.video_url || '';
      let owns_video = initial?.owns_video ?? true;

      if (videoMode === 'reuse') {
        video_url = reuseUrl;
        owns_video = false;   // belongs to a lesson; don't delete it with the question
      } else if (videoFile) {
        const storageRef = ref(storage, `quiz-videos/${moduleId}/${Date.now()}_${videoFile.name}`);
        const task = uploadBytesResumable(storageRef, videoFile);
        await new Promise((resolve, reject) => {
          task.on('state_changed',
            (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            reject,
            async () => { video_url = await getDownloadURL(task.snapshot.ref); resolve(); }
          );
        });
        owns_video = true;
      }

      // All 4 choices, correct included. Order here doesn't matter — the app shuffles.
      const choices = [correct.trim(), ...wrong.map((w) => w.trim())];

      const payload = {
        module_id: moduleId,
        video_url,
        owns_video,
        correct_answer: correct.trim(),
        choices,
        order: Number(order),
        status: 'published',
        teacher_id: currentUser?.uid,
      };

      if (initial) {
        await updateDoc(doc(db, 'quiz_questions', initial.id), payload);
      } else {
        await addDoc(collection(db, 'quiz_questions'), { ...payload, created_at: serverTimestamp() });
      }
      onSaved();
    } catch (err) {
      console.error(err);
      setError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-3">
        <button className="btn btn-sm btn-light rounded-3" onClick={onCancel}>
          <i className="bi bi-arrow-left"></i>
        </button>
        <h6 className="fw-bold mb-0">{initial ? 'Edit Question' : 'Add Question'}</h6>
      </div>

      {error && <div className="alert alert-danger py-2 small rounded-3 mb-3">{error}</div>}

      {/* Video source */}
      <label className="form-label small fw-medium">Sign Video</label>
      <div className="d-flex gap-2 mb-2">
        <button
          className={`btn btn-sm rounded-3 ${videoMode === 'upload' ? 'text-white' : 'btn-outline-secondary'}`}
          style={videoMode === 'upload' ? { backgroundColor: '#00838A' } : {}}
          onClick={() => setVideoMode('upload')}
        >
          <i className="bi bi-cloud-upload me-1"></i>Upload new
        </button>
        <button
          className={`btn btn-sm rounded-3 ${videoMode === 'reuse' ? 'text-white' : 'btn-outline-secondary'}`}
          style={videoMode === 'reuse' ? { backgroundColor: '#00838A' } : {}}
          onClick={() => setVideoMode('reuse')}
          disabled={moduleLessons.length === 0}
          title={moduleLessons.length === 0 ? 'No lesson videos in this module yet' : ''}
        >
          <i className="bi bi-collection-play me-1"></i>Reuse lesson video
        </button>
      </div>

      {videoMode === 'upload' ? (
        <>
          <input type="file" accept="video/*" className="form-control rounded-3 mb-1"
            onChange={(e) => setVideoFile(e.target.files[0])} />
          {initial?.video_url && !videoFile && (
            <small className="text-muted">A video is already set. Choosing a new file replaces it.</small>
          )}
          {saving && progress > 0 && progress < 100 && (
            <div className="progress rounded-pill mt-2" style={{ height: 6 }}>
              <div className="progress-bar" style={{ width: `${progress}%`, backgroundColor: '#00838A' }} />
            </div>
          )}
        </>
      ) : (
        <select className="form-select rounded-3" value={reuseUrl} onChange={(e) => setReuseUrl(e.target.value)}>
          <option value="">-- Choose a lesson video --</option>
          {moduleLessons.map((l) => (
            <option key={l.id} value={l.video_url}>{l.title}</option>
          ))}
        </select>
      )}

      {/* Choices */}
      <label className="form-label small fw-medium mt-3">Correct Answer</label>
      <input type="text" className="form-control rounded-3"
        style={{ borderColor: '#00838A', borderWidth: 2 }}
        placeholder="e.g. Hello" value={correct} onChange={(e) => setCorrect(e.target.value)} />

      <label className="form-label small fw-medium mt-3">Wrong Answers</label>
      {wrong.map((w, i) => (
        <input key={i} type="text" className="form-control rounded-3 mb-2"
          placeholder={`Wrong answer ${i + 1}`} value={w} onChange={(e) => setWrongAt(i, e.target.value)} />
      ))}

      <label className="form-label small fw-medium mt-2">Question Order</label>
      <input type="number" min={1} className="form-control rounded-3"
        value={order} onChange={(e) => setOrder(Number(e.target.value))} />

      <div className="d-flex gap-2 mt-4">
        <button className="btn flex-fill rounded-3 fw-medium text-white" style={{ backgroundColor: '#00838A' }}
          onClick={handleSubmit} disabled={saving}>
          {saving ? <span className="spinner-border spinner-border-sm"></span> : (initial ? 'Save Changes' : 'Add Question')}
        </button>
        <button className="btn btn-outline-secondary rounded-3" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Manage Quiz Modal (author video-choice questions for a module) ────────────
function ManageQuizModal({ module, lessons, onClose }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const moduleId = moduleIdOf(module.name);
  const moduleLessons = lessons.filter((l) => l.module_id === moduleId);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const snap = await getDocs(
      query(collection(db, 'quiz_questions'), where('module_id', '==', moduleId))
    );
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    setQuestions(list);
    setLoading(false);
  }, [moduleId]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleDelete = async (q) => {
    if (!window.confirm('Delete this quiz question? This cannot be undone.')) return;
    // Only delete the video file if it was uploaded for this question
    // (not if it's a reused lesson video — those belong to the lesson).
    if (q.video_url && q.owns_video) {
      try { await deleteObject(ref(storage, q.video_url)); } catch { /* already gone */ }
    }
    await deleteDoc(doc(db, 'quiz_questions', q.id));
    fetchQuestions();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 640, maxHeight: '88vh', overflowY: 'auto', backgroundColor: '#fff', borderRadius: 16, padding: 28, zIndex: 1070, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div className="d-flex justify-content-between align-items-center mb-1">
          <h5 className="fw-bold mb-0" style={{ color: '#00838A' }}>
            <i className="bi bi-patch-question-fill me-2"></i>Manage Quiz — {module.name}
          </h5>
          <button className="btn-close" onClick={onClose}></button>
        </div>
        <p className="small text-muted mb-3">
          Students watch each sign video and tap the correct word from 4 choices.
        </p>

        {!showForm && (
          <>
            <button
              className="btn rounded-3 fw-medium mb-3 text-white"
              style={{ backgroundColor: '#00838A' }}
              onClick={() => { setEditing(null); setShowForm(true); }}
            >
              <i className="bi bi-plus-circle-fill me-2"></i>Add Question
            </button>

            {loading ? (
              <div className="text-center py-4"><div className="spinner-border" style={{ color: '#00838A' }}></div></div>
            ) : questions.length === 0 ? (
              <div className="text-center py-4" style={{ color: '#666' }}>
                <i className="bi bi-patch-question fs-1 d-block mb-2 opacity-25"></i>
                No quiz questions yet. Add the first one!
              </div>
            ) : (
              questions.map((q) => (
                <div key={q.id} className="d-flex align-items-center gap-3 p-3 rounded-3 mb-2" style={{ backgroundColor: '#f8fafa', border: '1px solid #eee' }}>
                  <div className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 44, height: 44, backgroundColor: '#000', overflow: 'hidden' }}>
                    {q.video_url
                      ? <video src={q.video_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <i className="bi bi-camera-video-off text-white opacity-50"></i>}
                  </div>
                  <div className="flex-fill">
                    <p className="fw-semibold mb-0">#{q.order} · Answer: {q.correct_answer}</p>
                    <p className="small mb-0" style={{ color: '#666' }}>
                      Choices: {(q.choices || []).join(', ')}
                    </p>
                  </div>
                  <button className="btn btn-sm btn-outline-secondary rounded-3" onClick={() => { setEditing(q); setShowForm(true); }} title="Edit">
                    <i className="bi bi-pencil-fill"></i>
                  </button>
                  <button className="btn btn-sm btn-outline-danger rounded-3" onClick={() => handleDelete(q)} title="Delete">
                    <i className="bi bi-trash3"></i>
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {showForm && (
          <QuizQuestionForm
            moduleId={moduleId}
            moduleLessons={moduleLessons}
            initial={editing}
            nextOrder={questions.length > 0 ? Math.max(...questions.map((q) => q.order || 0)) + 1 : 1}
            onCancel={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); fetchQuestions(); }}
          />
        )}
      </div>
    </>
  );
}

// ─── Manage Modules Panel (list + archive/restore/edit/quiz) ───────────────────
function ManageModulesPanel({ modules, onClose, onAdd, onEdit, onArchive, onRestore, onManageQuiz }) {
  const active = modules.filter((m) => m.status !== 'archived');
  const archived = modules.filter((m) => m.status === 'archived');

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', backgroundColor: '#fff', borderRadius: 16, padding: 28, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="fw-bold mb-0" style={{ color: '#00838A' }}><i className="bi bi-collection-fill me-2"></i>Manage Modules</h5>
          <button className="btn-close" onClick={onClose}></button>
        </div>

        <button className="btn rounded-3 fw-medium mb-3 text-white" style={{ backgroundColor: '#00838A' }} onClick={onAdd}>
          <i className="bi bi-plus-circle-fill me-2"></i>Add New Module
        </button>

        {active.length === 0 && (
          <div className="text-center py-4" style={{ color: '#666' }}>No modules yet. Add your first one!</div>
        )}

        {active.map((m) => (
          <div key={m.id} className="d-flex align-items-center gap-3 p-3 rounded-3 mb-2" style={{ backgroundColor: '#f8fafa', border: '1px solid #eee' }}>
            <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 40, height: 40, backgroundColor: '#00838A18', overflow: 'hidden' }}>
              {m.icon_url
                ? <img src={m.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <i className={`bi ${m.icon || 'bi-collection-fill'}`} style={{ color: '#00838A' }}></i>}
            </div>
            <div className="flex-fill">
              <p className="fw-semibold mb-0">{m.name}</p>
            </div>
            {/* Manage Quiz — only for non-tracing modules (tracing = Alphabet/Numbers) */}
            {!TRACING_MODULE_IDS.includes(moduleIdOf(m.name)) && (
              <button className="btn btn-sm rounded-3" style={{ backgroundColor: '#00838A18', color: '#00838A' }}
                onClick={() => onManageQuiz(m)} title="Manage Quiz">
                <i className="bi bi-patch-question-fill"></i>
              </button>
            )}
            <button className="btn btn-sm btn-outline-secondary rounded-3" onClick={() => onEdit(m)} title="Edit"><i className="bi bi-pencil-fill"></i></button>
            <button className="btn btn-sm rounded-3" style={{ backgroundColor: '#fff3e0', color: '#d97706' }} onClick={() => onArchive(m)} title="Archive"><i className="bi bi-archive-fill"></i></button>
          </div>
        ))}

        {archived.length > 0 && (
          <>
            <h6 className="fw-semibold mt-4 mb-2" style={{ color: '#92400e' }}>Archived Modules</h6>
            {archived.map((m) => (
              <div key={m.id} className="d-flex align-items-center gap-3 p-3 rounded-3 mb-2" style={{ backgroundColor: '#fff8e1', border: '1px solid #ffe082' }}>
                <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 40, height: 40, backgroundColor: '#fef3c7', overflow: 'hidden' }}>
                  {m.icon_url
                    ? <img src={m.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <i className={`bi ${m.icon || 'bi-collection-fill'}`} style={{ color: '#d97706' }}></i>}
                </div>
                <div className="flex-fill">
                  <p className="fw-semibold mb-0">{m.name}</p>
                </div>
                <button className="btn btn-sm rounded-3 text-white" style={{ backgroundColor: '#00838A' }} onClick={() => onRestore(m)} title="Restore">
                  <i className="bi bi-arrow-counterclockwise"></i>
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}

export default function ManageModules() {
  const { currentUser } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showModulesPanel, setShowModulesPanel] = useState(false);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [savingModule, setSavingModule] = useState(false);
  const [quizModule, setQuizModule] = useState(null);   // module whose quiz is being managed
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filter, setFilter] = useState('All');
  const [form, setForm] = useState({
    module: '',
    title: '',
    description: '',
    video: null,
    order: 1,
  });

  const activeModules = modules.filter((m) => m.status !== 'archived');

  const fetchModules = useCallback(async () => {
    const snap = await getDocs(query(collection(db, 'modules'), orderBy('order', 'asc')));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setModules(list);
    return list;
  }, []);

  const fetchLessons = useCallback(async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'lessons'));
    setLessons(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const list = await fetchModules();
      await fetchLessons();
      const firstActive = list.find((m) => m.status !== 'archived');
      if (firstActive) setForm((f) => ({ ...f, module: firstActive.name }));
    })();
  }, [fetchModules, fetchLessons]);

  // ── Module CRUD ──
  const handleSaveModule = async (moduleForm) => {
    setSavingModule(true);
    try {
      const previousIconUrl = editingModule?.icon_url || null;
      let icon_url = previousIconUrl;

      if (moduleForm.iconFile) {
        const iconRef = ref(storage, `module-icons/${Date.now()}_${moduleForm.iconFile.name}`);
        await uploadBytesResumable(iconRef, moduleForm.iconFile).then((task) => task);
        icon_url = await getDownloadURL(iconRef);
      } else if (moduleForm.removeIcon) {
        icon_url = null;
      }

      if (previousIconUrl && previousIconUrl !== icon_url) {
        try { await deleteObject(ref(storage, previousIconUrl)); } catch { /* file may already be gone */ }
      }

      const payload = {
        name: moduleForm.name,
        order: moduleForm.order,
        icon_url: icon_url || null,
      };

      if (editingModule) {
        await updateDoc(doc(db, 'modules', editingModule.id), {
          ...payload,
          description: deleteField(),
          status: editingModule.status || 'active',
        });
      } else {
        await addDoc(collection(db, 'modules'), {
          ...payload,
          status: 'active',
          created_by: currentUser?.uid,
          created_at: serverTimestamp(),
        });
      }
      await fetchModules();
      setShowModuleForm(false);
      setEditingModule(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save module: ' + err.message);
    } finally {
      setSavingModule(false);
    }
  };

  const handleArchiveModule = async (m) => {
    if (!window.confirm(`Archive "${m.name}"? Existing lessons in this module are kept, but it will be hidden from new lessons.`)) return;
    await updateDoc(doc(db, 'modules', m.id), { status: 'archived' });
    fetchModules();
  };

  const handleRestoreModule = async (m) => {
    await updateDoc(doc(db, 'modules', m.id), { status: 'active' });
    fetchModules();
  };

  const nextOrder = modules.length > 0 ? Math.max(...modules.map((m) => m.order || 0)) + 1 : 1;

  // ── Lesson upload ──
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.video || !form.module) return;
    setUploading(true);

    try {
      const storageRef = ref(
        storage,
        `lessons/${form.module}/${Date.now()}_${form.video.name}`
      );
      const uploadTask = uploadBytesResumable(storageRef, form.video);

      uploadTask.on(
        'state_changed',
        (snap) => {
          setUploadProgress(
            Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
          );
        },
        (err) => {
          console.error(err);
          setUploading(false);
        },
        async () => {
          const videoUrl = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, 'lessons'), {
            module_id: form.module.toLowerCase().replace(/\s/g, '_'),
            module_title: form.module,
            title: form.title,
            description: form.description,
            video_url: videoUrl,
            order: form.order,
            teacher_id: currentUser?.uid,
            created_at: serverTimestamp(),
            status: 'published',
          });
          setShowLessonModal(false);
          setForm((f) => ({
            ...f,
            title: '',
            description: '',
            video: null,
            order: 1,
          }));
          setUploadProgress(0);
          setUploading(false);
          fetchLessons();
        }
      );
    } catch (err) {
      console.error(err);
      setUploading(false);
    }
  };

  const handleDeleteLesson = async (lesson) => {
    // Check whether any quiz questions reuse this lesson's video before deleting.
    // A reused video has owns_video: false on the question and points at this exact URL.
    let reusedBy = [];
    if (lesson.video_url) {
      try {
        const snap = await getDocs(
          query(collection(db, 'quiz_questions'), where('video_url', '==', lesson.video_url))
        );
        reusedBy = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.error('Could not check quiz questions for reused video:', err);
      }
    }

    if (reusedBy.length > 0) {
      const ok = window.confirm(
        `${reusedBy.length} quiz question${reusedBy.length > 1 ? 's' : ''} reuse this lesson's video.\n\n` +
        `The lesson will be removed, but its video file will be KEPT so those quiz questions keep working. Continue?`
      );
      if (!ok) return;

      // Keep the Storage video (still needed by the quiz); remove only the lesson doc.
      try {
        await deleteDoc(doc(db, 'lessons', lesson.id));
        fetchLessons();
      } catch (err) {
        alert('Failed to delete: ' + err.message);
      }
      return;
    }

    // No quiz question depends on this video — safe to remove the file too.
    if (!window.confirm('Delete this lesson? This removes the video file too and cannot be undone. (For students/teachers, use Archive instead — lessons are just content, not personal records.)')) return;
    try {
      if (lesson.video_url) {
        try { await deleteObject(ref(storage, lesson.video_url)); } catch { /* file may already be gone */ }
      }
      await deleteDoc(doc(db, 'lessons', lesson.id));
      fetchLessons();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const filtered =
    filter === 'All' ? lessons : lessons.filter((l) => l.module_title === filter);

  return (
    <div className="d-flex">
      <Sidebar />
      <div
        style={{
          marginLeft: '250px',
          width: '100%',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Navbar title="Manage Modules" />

        <div className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
            <div className="d-flex gap-2 flex-wrap">
              {[{ id: 'all', name: 'All', icon_url: null }, ...activeModules].map((m) => (
                <button
                  key={m.id}
                  className={`btn btn-sm rounded-pill d-flex align-items-center gap-1 ${
                    filter === m.name ? 'text-white' : 'btn-outline-secondary'
                  }`}
                  style={filter === m.name ? { backgroundColor: '#00838A' } : {}}
                  onClick={() => setFilter(m.name)}
                >
                  {m.icon_url && (
                    <img src={m.icon_url} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'contain' }} />
                  )}
                  {m.name}
                </button>
              ))}
            </div>
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-secondary rounded-3"
                onClick={() => setShowModulesPanel(true)}
              >
                <i className="bi bi-gear-fill me-2"></i>
                Manage Modules
              </button>
              <button
                className="btn text-white rounded-3"
                style={{ backgroundColor: '#00838A' }}
                onClick={() => setShowLessonModal(true)}
                disabled={activeModules.length === 0}
                title={activeModules.length === 0 ? 'Add a module first' : ''}
              >
                <i className="bi bi-plus-circle-fill me-2"></i>
                Add Lesson
              </button>
            </div>
          </div>

          {activeModules.length === 0 && !loading && (
            <div className="alert rounded-4 d-flex align-items-center gap-2" style={{ backgroundColor: '#fff8e1', border: '1px solid #ffe082', color: '#78550a' }}>
              <i className="bi bi-info-circle-fill"></i>
              No modules yet. Click <strong className="mx-1">Manage Modules</strong> to create your first FSL module (e.g. Alphabet, Numbers, Greetings) before adding lessons.
            </div>
          )}

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border" style={{ color: '#00838A' }}></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-5" style={{ color: '#555' }}>
              <i className="bi bi-collection fs-1 d-block mb-2 opacity-25"></i>
              No lessons yet. Add your first FSL lesson!
            </div>
          ) : (
            <div className="row g-3">
              {filtered
                .slice()
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((lesson) => (
                <div key={lesson.id} className="col-md-4">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div
                      className="rounded-top-4 d-flex align-items-center justify-content-center"
                      style={{ height: 150, backgroundColor: '#000', overflow: 'hidden' }}
                    >
                      {lesson.video_url ? (
                        <video
                          src={lesson.video_url}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <i className="bi bi-play-circle text-white opacity-25 fs-1"></i>
                      )}
                    </div>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <span
                          className="badge rounded-pill"
                          style={{ backgroundColor: '#00838A18', color: '#00838A' }}
                        >
                          {lesson.module_title}
                        </span>
                        {lesson.order !== undefined && (
                          <span className="badge bg-light text-dark border">
                            #{lesson.order}
                          </span>
                        )}
                      </div>
                      <h6 className="fw-semibold mb-1">{lesson.title}</h6>
                      <p className="small mb-3" style={{ color: '#555' }}>{lesson.description}</p>
                      <div className="d-flex gap-2">
                        <a
                          href={lesson.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-outline-secondary rounded-3 flex-grow-1"
                        >
                          <i className="bi bi-play-fill me-1"></i>
                          Preview
                        </a>
                        <button
                          className="btn btn-sm btn-outline-danger rounded-3"
                          onClick={() => handleDeleteLesson(lesson)}
                        >
                          <i className="bi bi-trash3"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showLessonModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-semibold">Add FSL Lesson</h5>
                <button
                  className="btn-close"
                  onClick={() => setShowLessonModal(false)}
                ></button>
              </div>
              <form onSubmit={handleUpload}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-medium">Module</label>
                    <select
                      className="form-select rounded-3"
                      value={form.module}
                      onChange={(e) => setForm({ ...form, module: e.target.value })}
                    >
                      {activeModules.map((m) => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-medium">Lesson Title</label>
                    <input
                      type="text"
                      className="form-control rounded-3"
                      placeholder="e.g. Letter A"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-medium">Lesson Order</label>
                    <input
                      type="number"
                      className="form-control rounded-3"
                      placeholder="e.g. 1"
                      value={form.order}
                      onChange={(e) =>
                        setForm({ ...form, order: Number(e.target.value) })
                      }
                      min={1}
                      required
                    />
                    <small style={{ color: '#666' }}>
                      Position of this lesson within the module (1, 2, 3...)
                    </small>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-medium">Description</label>
                    <textarea
                      className="form-control rounded-3"
                      rows={3}
                      placeholder="Brief description of the sign..."
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-medium">
                      FSL Demo Video
                    </label>
                    <input
                      type="file"
                      accept="video/*"
                      className="form-control rounded-3"
                      onChange={(e) =>
                        setForm({ ...form, video: e.target.files[0] })
                      }
                      required
                    />
                    <small style={{ color: '#666' }}>
                      Upload your recorded FSL demonstration video
                    </small>
                  </div>
                  {uploading && (
                    <div className="mt-2">
                      <div className="d-flex justify-content-between small mb-1">
                        <span style={{ color: '#555' }}>Uploading video...</span>
                        <span style={{ color: '#00838A' }}>{uploadProgress}%</span>
                      </div>
                      <div className="progress rounded-pill" style={{ height: 6 }}>
                        <div
                          className="progress-bar"
                          style={{
                            width: `${uploadProgress}%`,
                            backgroundColor: '#00838A',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button
                    type="button"
                    className="btn btn-light rounded-3"
                    onClick={() => setShowLessonModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn text-white rounded-3"
                    style={{ backgroundColor: '#00838A' }}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-cloud-upload me-2"></i>
                        Upload Lesson
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showModulesPanel && (
        <ManageModulesPanel
          modules={modules}
          onClose={() => setShowModulesPanel(false)}
          onAdd={() => { setEditingModule(null); setShowModuleForm(true); }}
          onEdit={(m) => { setEditingModule(m); setShowModuleForm(true); }}
          onArchive={handleArchiveModule}
          onRestore={handleRestoreModule}
          onManageQuiz={(m) => setQuizModule(m)}
        />
      )}

      {showModuleForm && (
        <ModuleFormModal
          initial={editingModule}
          nextOrder={nextOrder}
          saving={savingModule}
          onClose={() => { setShowModuleForm(false); setEditingModule(null); }}
          onSave={handleSaveModule}
        />
      )}

      {quizModule && (
        <ManageQuizModal
          module={quizModule}
          lessons={lessons}
          onClose={() => setQuizModule(null)}
        />
      )}
    </div>
  );
}