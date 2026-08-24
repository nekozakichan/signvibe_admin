import { useState, useEffect, useCallback } from 'react';
import { db } from '../../api/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import { API_BASE } from '../../config/api';
import { buildFullName } from '../../utils/name';

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  return Array.from({ length: 10 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
}

// ─── Add Student Modal ────────────────────────────────────────────────────────
function AddStudentModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '',
    email: '', grade_level: '', section: '',
  });
  const [generatedPassword] = useState(generatePassword());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    const { first_name, last_name, email, grade_level, section } = form;
    if (!first_name.trim() || !last_name.trim() || !email.trim() || !grade_level || !section.trim()) {
      setError('First name, last name, email, grade, and section are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create student.');
      onSuccess({ ...form, full_name: buildFullName(form), password: data.generatedPassword });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 520, backgroundColor: '#fff', borderRadius: 16, padding: 32, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>

        <div className="d-flex justify-content-between align-items-start mb-4">
          <div>
            <h5 className="fw-bold mb-0" style={{ color: '#008080' }}>
              <i className="bi bi-person-plus-fill me-2"></i>Add Student
            </h5>
            <p className="small mb-0 mt-1" style={{ color: '#555' }}>Create a student account. You can send the credentials to their Gmail after.</p>
          </div>
          <button className="btn-close" onClick={onClose}></button>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small rounded-3 mb-3">
            <i className="bi bi-exclamation-circle me-1"></i>{error}
          </div>
        )}

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <label className="form-label fw-medium small">First Name</label>
            <input name="first_name" type="text" className="form-control rounded-3" placeholder="e.g. Juan" value={form.first_name} onChange={handleChange} />
          </div>
          <div className="col-md-4">
            <label className="form-label fw-medium small">Middle Name <span style={{ color: '#777', fontSize: 11 }}>(optional)</span></label>
            <input name="middle_name" type="text" className="form-control rounded-3" placeholder="e.g. Reyes" value={form.middle_name} onChange={handleChange} />
          </div>
          <div className="col-md-4">
            <label className="form-label fw-medium small">Last Name</label>
            <input name="last_name" type="text" className="form-control rounded-3" placeholder="e.g. Dela Cruz" value={form.last_name} onChange={handleChange} />
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label fw-medium small">
            Email Address
            <span className="ms-1" style={{ fontSize: 11, color: '#777' }}>(This will be the student's username)</span>
          </label>
          <input name="email" type="email" className="form-control rounded-3" placeholder="student@gmail.com" value={form.email} onChange={handleChange} />
        </div>

        <div className="row g-3 mb-3">
          <div className="col-6">
            <label className="form-label fw-medium small">Grade Level</label>
            <select name="grade_level" className="form-select rounded-3" value={form.grade_level} onChange={handleChange}>
              <option value="">-- Select Grade --</option>
              {[1,2,3,4,5,6].map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </div>
          <div className="col-6">
            <label className="form-label fw-medium small">Section</label>
            <input name="section" type="text" className="form-control rounded-3" placeholder="e.g. Sampaguita" value={form.section} onChange={handleChange} />
          </div>
        </div>

        <div className="mb-4">
          <label className="form-label fw-medium small">Auto-Generated Password</label>
          <div className="input-group">
            <input
              type="text"
              readOnly
              className="form-control rounded-start-3"
              style={{ backgroundColor: '#f0fafa', letterSpacing: 2, fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#111' }}
              value={generatedPassword}
            />
            <button className="btn btn-outline-secondary rounded-end-3" onClick={copyPassword} type="button" title="Copy password">
              <i className={`bi ${copied ? 'bi-check-lg text-success' : 'bi-clipboard'}`}></i>
              <span className="ms-1 small">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
          <p className="mt-1" style={{ fontSize: 11, color: '#666' }}>
            This password is auto-generated and will be saved. You can send it to the student's Gmail anytime using the <strong>"Send Credentials"</strong> button.
          </p>
        </div>

        <div className="d-flex gap-2">
          <button
            className="btn flex-fill rounded-3 fw-medium"
            style={{ backgroundColor: '#008080', color: '#fff' }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Creating Account...</>
              : <><i className="bi bi-person-check-fill me-1"></i>Create Account</>
            }
          </button>
          <button className="btn btn-outline-secondary rounded-3" onClick={onClose} disabled={loading}>Cancel</button>
        </div>
      </div>
    </>
  );
}

// ─── Account Created Modal ─────────────────────────────────────────────────────
function AccountCreatedModal({ student, onClose, onSendNow }) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendNow = async () => {
    setSending(true);
    await onSendNow();
    setSending(false);
    setSent(true);
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: 16, padding: 32, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', textAlign: 'center' }}>

        <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64, backgroundColor: '#e6f9f9' }}>
          <i className="bi bi-person-check-fill fs-2" style={{ color: '#008080' }}></i>
        </div>

        <h5 className="fw-bold mb-1" style={{ color: '#008080' }}>Account Created!</h5>
        <p className="small mb-4" style={{ color: '#555' }}>The account for <strong>{student.full_name}</strong> has been created successfully.</p>

        <div className="text-start p-3 rounded-3 mb-4" style={{ backgroundColor: '#f0fafa', border: '1px solid #b2dfdb' }}>
          <p className="fw-semibold small mb-2" style={{ color: '#008080' }}>
            <i className="bi bi-person-fill me-1"></i>Login Credentials
          </p>
          <div className="mb-2">
            <span style={{ fontSize: 12, color: '#555' }}>Username (Email)</span>
            <div className="d-flex align-items-center gap-2 mt-1">
              <code className="flex-fill px-2 py-1 rounded" style={{ backgroundColor: '#e0f4f4', color: '#005f5f', fontSize: 13 }}>{student.email}</code>
            </div>
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#555' }}>Password</span>
            <div className="d-flex align-items-center gap-2 mt-1">
              <code className="flex-fill px-2 py-1 rounded" style={{ backgroundColor: '#e0f4f4', color: '#005f5f', fontSize: 15, fontWeight: 700, letterSpacing: 2 }}>{student.password}</code>
              <button className="btn btn-sm btn-outline-secondary rounded-2" onClick={() => copy(student.password)}>
                <i className={`bi ${copied ? 'bi-check-lg text-success' : 'bi-clipboard'}`}></i>
              </button>
            </div>
          </div>
        </div>

        <p className="small mb-4" style={{ color: '#555' }}>
          Do you want to send these credentials to <strong>{student.email}</strong> right now?
        </p>

        <div className="d-flex gap-2">
          {!sent ? (
            <button
              className="btn flex-fill rounded-3 fw-medium"
              style={{ backgroundColor: '#008080', color: '#fff' }}
              onClick={handleSendNow}
              disabled={sending}
            >
              {sending
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Sending...</>
                : <><i className="bi bi-envelope-fill me-2"></i>Send Credentials to Gmail</>
              }
            </button>
          ) : (
            <div className="flex-fill rounded-3 py-2 d-flex align-items-center justify-content-center gap-2" style={{ backgroundColor: '#e6f9f9', border: '1px solid #008080' }}>
              <i className="bi bi-check-circle-fill" style={{ color: '#008080' }}></i>
              <span className="fw-medium" style={{ color: '#008080' }}>Credentials sent to Gmail!</span>
            </div>
          )}
          <button className="btn btn-outline-secondary rounded-3" onClick={onClose}>
            {sent ? 'Done' : 'Skip for now'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Archive Modal (replaces permanent delete) ─────────────────────────────────
function ArchiveModal({ student, onClose, onConfirm, loading }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 32, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="text-center mb-4">
          <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64, backgroundColor: '#fff3e0' }}>
            <i className="bi bi-archive-fill fs-2" style={{ color: '#d97706' }}></i>
          </div>
          <h5 className="fw-bold mb-1">Archive Student?</h5>
          <p className="small mb-0" style={{ color: '#555' }}>
            <strong>{student.full_name}</strong>'s account will be deactivated and moved to the
            Archived tab, keeping their progress records intact. You can restore it anytime.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-danger flex-fill rounded-3 fw-medium text-white" style={{ backgroundColor: '#d97706', borderColor: '#d97706' }} onClick={onConfirm} disabled={loading}>
            {loading ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-archive-fill me-1"></i>Yes, Archive</>}
          </button>
          <button className="btn btn-outline-secondary flex-fill rounded-3" onClick={onClose} disabled={loading}>Cancel</button>
        </div>
      </div>
    </>
  );
}

// ─── Restore Modal ──────────────────────────────────────────────────────────────
function RestoreModal({ student, onClose, onConfirm, loading }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 32, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="text-center mb-4">
          <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64, backgroundColor: '#e6f9f9' }}>
            <i className="bi bi-arrow-counterclockwise fs-2" style={{ color: '#008080' }}></i>
          </div>
          <h5 className="fw-bold mb-1">Restore Student?</h5>
          <p className="small mb-0" style={{ color: '#555' }}>
            <strong>{student.full_name}</strong>'s account will be reactivated and moved back to the active list.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn flex-fill rounded-3 fw-medium text-white" style={{ backgroundColor: '#008080' }} onClick={onConfirm} disabled={loading}>
            {loading ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-arrow-counterclockwise me-1"></i>Yes, Restore</>}
          </button>
          <button className="btn btn-outline-secondary flex-fill rounded-3" onClick={onClose} disabled={loading}>Cancel</button>
        </div>
      </div>
    </>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toast, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  const isSuccess = toast.type === 'success';
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, minWidth: 300, maxWidth: 400, backgroundColor: isSuccess ? '#e6f9f9' : '#fdecea', border: `1px solid ${isSuccess ? '#008080' : '#e53935'}`, borderRadius: 12, padding: '14px 18px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <i className={`bi ${isSuccess ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'} fs-5 mt-1`} style={{ color: isSuccess ? '#008080' : '#e53935', flexShrink: 0 }}></i>
      <div className="flex-fill">
        <p className="fw-semibold mb-0" style={{ fontSize: 14, color: isSuccess ? '#005f5f' : '#b71c1c' }}>{toast.message}</p>
        {toast.sub && <p className="mb-0 mt-1" style={{ fontSize: 12, color: '#444' }}>{toast.sub}</p>}
      </div>
      <button className="btn-close btn-close-sm" onClick={onClose}></button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StudentsList() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [lessonsCompletedMap, setLessonsCompletedMap] = useState({});
  const [pointsMap, setPointsMap] = useState({});
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [createdStudent, setCreatedStudent] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [sendLoadingId, setSendLoadingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [view, setView] = useState('active'); // 'active' | 'archived'

  const fetchStudents = useCallback(async () => {
    setLoading(true);

    const q = query(collection(db, 'users'), where('role', '==', 'student'));
    const snap = await getDocs(q);
    setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

    // Lessons-completed per student, from student_progress — the users doc's
    // lessons_completed / total_points fields are never written, so we derive
    // both from the real activity collections instead (same fix used on the
    // Class Overview and Reports screens).
    const progressSnap = await getDocs(
      query(collection(db, 'student_progress'), where('is_completed', '==', true))
    );
    const lessonCounts = {};
    progressSnap.docs.forEach((d) => {
      const sid = d.data().student_id;
      if (sid) lessonCounts[sid] = (lessonCounts[sid] || 0) + 1;
    });
    setLessonsCompletedMap(lessonCounts);

    // Total stars per student, from quiz_results.stars_earned.
    const quizSnap = await getDocs(collection(db, 'quiz_results'));
    const stars = {};
    quizSnap.docs.forEach((d) => {
      const { student_id, stars_earned } = d.data();
      if (student_id) stars[student_id] = (stars[student_id] || 0) + (stars_earned || 0);
    });
    setPointsMap(stars);

    setLoading(false);
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const displayName = (s) => s.full_name || buildFullName(s);

  const activeStudents = students.filter((s) => s.status !== 'archived');
  const archivedStudents = students.filter((s) => s.status === 'archived');
  const source = view === 'active' ? activeStudents : archivedStudents;

  const grades = [...new Set(source.map((s) => s.grade_level).filter(Boolean))].sort((a, b) => Number(a) - Number(b));

  const filtered = source.filter((s) => {
    const matchName = displayName(s).toLowerCase().includes(search.toLowerCase());
    const matchGrade = !filterGrade || s.grade_level === filterGrade;
    return matchName && matchGrade;
  });

  const handleCreated = (studentData) => {
    setShowModal(false);
    setCreatedStudent(studentData);
    fetchStudents();
  };

  const doSendCredentials = async (uid) => {
    const res = await fetch(`${API_BASE}/api/students/${uid}/send-credentials`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data;
  };

  const handleSendFromModal = async () => {
    const student = students.find((s) => s.email === createdStudent.email);
    if (!student) return;
    try {
      await doSendCredentials(student.id);
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to send', sub: err.message });
    }
  };

  const handleSendCredentials = async (student) => {
    setSendLoadingId(student.id);
    try {
      await doSendCredentials(student.id);
      setToast({ type: 'success', message: 'Credentials sent!', sub: `Username & password emailed to ${student.email}` });
    } catch (err) {
      setToast({ type: 'error', message: 'Send failed', sub: err.message });
    } finally {
      setSendLoadingId(null);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/students/${archiveTarget.id}/archive`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setToast({ type: 'success', message: 'Student archived', sub: `${displayName(archiveTarget)} was moved to Archived.` });
      setArchiveTarget(null);
      fetchStudents();
    } catch (err) {
      setToast({ type: 'error', message: 'Archive failed', sub: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/students/${restoreTarget.id}/restore`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setToast({ type: 'success', message: 'Student restored', sub: `${displayName(restoreTarget)} is active again.` });
      setRestoreTarget(null);
      fetchStudents();
    } catch (err) {
      setToast({ type: 'error', message: 'Restore failed', sub: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="d-flex">
      <Sidebar />
      <div style={{ marginLeft: '250px', width: '100%', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <Navbar title="Students List" />

        <div className="p-4">

          {/* Tabs */}
          <div className="d-flex gap-2 mb-3">
            <button
              className={`btn btn-sm rounded-pill ${view === 'active' ? 'text-white' : 'btn-outline-secondary'}`}
              style={view === 'active' ? { backgroundColor: '#008080' } : {}}
              onClick={() => { setView('active'); setFilterGrade(''); }}
            >
              <i className="bi bi-people-fill me-1"></i>Active ({activeStudents.length})
            </button>
            <button
              className={`btn btn-sm rounded-pill ${view === 'archived' ? 'text-white' : 'btn-outline-secondary'}`}
              style={view === 'archived' ? { backgroundColor: '#d97706' } : {}}
              onClick={() => { setView('archived'); setFilterGrade(''); }}
            >
              <i className="bi bi-archive-fill me-1"></i>Archived ({archivedStudents.length})
            </button>
          </div>

          {/* Toolbar */}
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <div className="input-group" style={{ width: 260 }}>
                <span className="input-group-text bg-white border-end-0"><i className="bi bi-search" style={{ color: '#555' }}></i></span>
                <input type="text" className="form-control border-start-0 ps-0 rounded-end-3" placeholder="Search student name..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select className="form-select rounded-3" style={{ width: 'auto' }} value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
                <option value="">All Grades</option>
                {grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
              {(filterGrade || search) && (
                <button className="btn btn-sm btn-outline-secondary rounded-3" onClick={() => { setSearch(''); setFilterGrade(''); }}>
                  <i className="bi bi-x me-1"></i>Clear
                </button>
              )}
            </div>
            <div className="d-flex align-items-center gap-3">
              <small style={{ color: '#555' }}>{filtered.length} student(s)</small>
              {view === 'active' && (
                <button className="btn rounded-3 fw-medium" style={{ backgroundColor: '#008080', color: '#fff' }} onClick={() => setShowModal(true)}>
                  <i className="bi bi-person-plus-fill me-2"></i>Add Student
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-0">
              {loading ? (
                <div className="text-center py-5"><div className="spinner-border" style={{ color: '#008080' }}></div></div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-4 py-3">#</th>
                        <th>Student Name</th>
                        <th>Email / Username</th>
                        <th>Grade & Section</th>
                        <th>Lessons</th>
                        <th>Stars</th>
                        <th className="pe-4 text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-5" style={{ color: '#555' }}>
                            <i className="bi bi-people fs-1 d-block mb-2 opacity-25"></i>
                            {view === 'active' ? 'No students found' : 'No archived students'}
                          </td>
                        </tr>
                      ) : (
                        filtered.map((s, i) => (
                          <tr key={s.id}>
                            <td className="ps-4 small" style={{ color: '#555' }}>{i + 1}</td>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 36, height: 36, backgroundColor: '#00838A18', flexShrink: 0 }}>
                                  <i className="bi bi-person-fill" style={{ color: '#00838A' }}></i>
                                </div>
                                <span className="fw-medium">{displayName(s)}</span>
                              </div>
                            </td>
                            <td className="small" style={{ color: '#444' }}>{s.email}</td>
                            <td>
                              <span className="badge rounded-pill" style={{ backgroundColor: '#00838A18', color: '#00838A', fontWeight: 500, fontSize: 12 }}>
                                Grade {s.grade_level} – {s.section}
                              </span>
                            </td>
                            <td><span className="badge bg-success bg-opacity-10 text-success rounded-pill px-3">{lessonsCompletedMap[s.id] || 0}</span></td>
                            <td><span className="fw-semibold" style={{ color: '#F57F17' }}>{pointsMap[s.id] || 0} ⭐</span></td>
                            <td className="pe-4">
                              <div className="d-flex justify-content-end gap-1 flex-wrap">

                                {/* View Progress */}
                                <button
                                  className="btn btn-sm rounded-3"
                                  style={{ backgroundColor: '#00838A18', color: '#00838A' }}
                                  onClick={() => navigate(`/teacher/students/${s.id}/progress`)}
                                  title="View Progress"
                                >
                                  <i className="bi bi-eye-fill"></i>
                                </button>

                                {view === 'active' ? (
                                  <>
                                    {/* Send Credentials */}
                                    <button
                                      className="btn btn-sm rounded-3 fw-medium d-flex align-items-center gap-1"
                                      style={{ backgroundColor: '#008080', color: '#fff', fontSize: 12 }}
                                      onClick={() => handleSendCredentials(s)}
                                      disabled={sendLoadingId === s.id}
                                      title={`Send username & password to ${s.email}`}
                                    >
                                      {sendLoadingId === s.id
                                        ? <span className="spinner-border spinner-border-sm"></span>
                                        : <><i className="bi bi-envelope-fill"></i><span>Send</span></>
                                      }
                                    </button>

                                    {/* Archive */}
                                    <button
                                      className="btn btn-sm rounded-3"
                                      style={{ backgroundColor: '#fff3e0', color: '#d97706' }}
                                      onClick={() => setArchiveTarget(s)}
                                      title="Archive student"
                                    >
                                      <i className="bi bi-archive-fill"></i>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="btn btn-sm rounded-3 fw-medium d-flex align-items-center gap-1"
                                    style={{ backgroundColor: '#008080', color: '#fff', fontSize: 12 }}
                                    onClick={() => setRestoreTarget(s)}
                                    title="Restore student"
                                  >
                                    <i className="bi bi-arrow-counterclockwise"></i><span>Restore</span>
                                  </button>
                                )}

                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && <AddStudentModal onClose={() => setShowModal(false)} onSuccess={handleCreated} />}

      {createdStudent && (
        <AccountCreatedModal
          student={createdStudent}
          onClose={() => setCreatedStudent(null)}
          onSendNow={handleSendFromModal}
        />
      )}

      {archiveTarget && (
        <ArchiveModal student={{ ...archiveTarget, full_name: displayName(archiveTarget) }} onClose={() => setArchiveTarget(null)} onConfirm={handleArchive} loading={actionLoading} />
      )}

      {restoreTarget && (
        <RestoreModal student={{ ...restoreTarget, full_name: displayName(restoreTarget) }} onClose={() => setRestoreTarget(null)} onConfirm={handleRestore} loading={actionLoading} />
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}