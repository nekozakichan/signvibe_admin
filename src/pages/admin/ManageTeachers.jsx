import { useState, useEffect, useCallback } from 'react';
import { db } from '../../api/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import { ListSkeleton } from '../../components/Skeletons';
import { API_BASE } from '../../config/api';
import { buildFullName } from '../../utils/name';

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  return Array.from({ length: 10 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
}

// ─── Create Teacher Modal ─────────────────────────────────────────────────────
function CreateTeacherModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '',
    email: '', employee_no: '', section_handled: '',
  });
  const [generatedPassword] = useState(generatePassword());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const copyPassword = () => { navigator.clipboard.writeText(generatedPassword); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const handleSubmit = async () => {
    const { first_name, last_name, email, employee_no, section_handled } = form;
    if (!first_name.trim() || !last_name.trim() || !email.trim() || !employee_no.trim() || !section_handled.trim()) {
      setError('First name, last name, email, employee no., and section are required.');
      return;
    }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/teachers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create teacher.');
      onSuccess({ ...form, full_name: buildFullName(form), password: data.generatedPassword });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 540, backgroundColor: '#fff', borderRadius: 16, padding: 32, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="d-flex justify-content-between align-items-start mb-4">
          <div>
            <h5 className="fw-bold mb-0" style={{ color: '#008080' }}><i className="bi bi-person-badge-fill me-2"></i>Create Teacher Account</h5>
            <p className="small mb-0 mt-1" style={{ color: '#555' }}>Create an account. You can send credentials to their Gmail after.</p>
          </div>
          <button className="btn-close" onClick={onClose}></button>
        </div>
        {error && <div className="alert alert-danger py-2 small rounded-3 mb-3"><i className="bi bi-exclamation-circle me-1"></i>{error}</div>}

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <label className="form-label fw-medium small">First Name</label>
            <input name="first_name" type="text" className="form-control rounded-3" placeholder="e.g. Maria" value={form.first_name} onChange={handleChange} />
          </div>
          <div className="col-md-4">
            <label className="form-label fw-medium small">Middle Name <span style={{ color: '#777', fontSize: 11 }}>(optional)</span></label>
            <input name="middle_name" type="text" className="form-control rounded-3" placeholder="e.g. Reyes" value={form.middle_name} onChange={handleChange} />
          </div>
          <div className="col-md-4">
            <label className="form-label fw-medium small">Last Name</label>
            <input name="last_name" type="text" className="form-control rounded-3" placeholder="e.g. Santos" value={form.last_name} onChange={handleChange} />
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label fw-medium small">Email Address <span style={{ color: '#777', fontSize: 11 }}>(will be used as username)</span></label>
          <input name="email" type="email" className="form-control rounded-3" placeholder="teacher@gmail.com" value={form.email} onChange={handleChange} />
        </div>
        <div className="row g-3 mb-3">
          <div className="col-6">
            <label className="form-label fw-medium small">Employee No.</label>
            <input name="employee_no" type="text" className="form-control rounded-3" placeholder="e.g. EMP-001" value={form.employee_no} onChange={handleChange} />
          </div>
          <div className="col-6">
            <label className="form-label fw-medium small">Section Handled</label>
            <input name="section_handled" type="text" className="form-control rounded-3" placeholder="e.g. Grade 3 - Sampaguita" value={form.section_handled} onChange={handleChange} />
          </div>
        </div>
        <div className="mb-4">
          <label className="form-label fw-medium small">Auto-Generated Password</label>
          <div className="input-group">
            <input type="text" readOnly className="form-control rounded-start-3" style={{ backgroundColor: '#f0fafa', letterSpacing: 2, fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#111' }} value={generatedPassword} />
            <button className="btn btn-outline-secondary rounded-end-3" onClick={copyPassword} type="button">
              <i className={`bi ${copied ? 'bi-check-lg text-success' : 'bi-clipboard'}`}></i>
              <span className="ms-1 small">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
          <p className="mt-1" style={{ fontSize: 11, color: '#666' }}>Use the <strong>"Send"</strong> button in the table to email it to the teacher anytime.</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn flex-fill rounded-3 fw-medium" style={{ backgroundColor: '#008080', color: '#fff' }} onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Creating...</> : <><i className="bi bi-person-check-fill me-1"></i>Create Account</>}
          </button>
          <button className="btn btn-outline-secondary rounded-3" onClick={onClose} disabled={loading}>Cancel</button>
        </div>
      </div>
    </>
  );
}

// ─── Account Created Modal ────────────────────────────────────────────────────
function AccountCreatedModal({ teacher, onClose, onSendNow }) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const copy = (text) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleSendNow = async () => { setSending(true); await onSendNow(); setSending(false); setSent(true); };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: 16, padding: 32, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', textAlign: 'center' }}>
        <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64, backgroundColor: '#e6f9f9' }}>
          <i className="bi bi-person-check-fill fs-2" style={{ color: '#008080' }}></i>
        </div>
        <h5 className="fw-bold mb-1" style={{ color: '#008080' }}>Account Created!</h5>
        <p className="small mb-4" style={{ color: '#555' }}>The account for <strong>{teacher.full_name}</strong> has been created successfully.</p>
        <div className="text-start p-3 rounded-3 mb-4" style={{ backgroundColor: '#f0fafa', border: '1px solid #b2dfdb' }}>
          <p className="fw-semibold small mb-2" style={{ color: '#008080' }}><i className="bi bi-person-badge-fill me-1"></i>Login Credentials</p>
          <div className="mb-2">
            <span style={{ fontSize: 12, color: '#555' }}>Username (Email)</span>
            <code className="d-block mt-1 px-2 py-1 rounded" style={{ backgroundColor: '#e0f4f4', color: '#005f5f', fontSize: 13 }}>{teacher.email}</code>
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#555' }}>Password</span>
            <div className="d-flex align-items-center gap-2 mt-1">
              <code className="flex-fill px-2 py-1 rounded" style={{ backgroundColor: '#e0f4f4', color: '#005f5f', fontSize: 15, fontWeight: 700, letterSpacing: 2 }}>{teacher.password}</code>
              <button className="btn btn-sm btn-outline-secondary rounded-2" onClick={() => copy(teacher.password)}>
                <i className={`bi ${copied ? 'bi-check-lg text-success' : 'bi-clipboard'}`}></i>
              </button>
            </div>
          </div>
        </div>
        <p className="small mb-4" style={{ color: '#555' }}>Send these credentials to <strong>{teacher.email}</strong> right now?</p>
        <div className="d-flex gap-2">
          {!sent ? (
            <button className="btn flex-fill rounded-3 fw-medium" style={{ backgroundColor: '#008080', color: '#fff' }} onClick={handleSendNow} disabled={sending}>
              {sending ? <><span className="spinner-border spinner-border-sm me-2"></span>Sending...</> : <><i className="bi bi-envelope-fill me-2"></i>Send Credentials to Gmail</>}
            </button>
          ) : (
            <div className="flex-fill rounded-3 py-2 d-flex align-items-center justify-content-center gap-2" style={{ backgroundColor: '#e6f9f9', border: '1px solid #008080' }}>
              <i className="bi bi-check-circle-fill" style={{ color: '#008080' }}></i>
              <span className="fw-medium" style={{ color: '#008080' }}>Credentials sent to Gmail!</span>
            </div>
          )}
          <button className="btn btn-outline-secondary rounded-3" onClick={onClose}>{sent ? 'Done' : 'Skip for now'}</button>
        </div>
      </div>
    </>
  );
}

// ─── Archive Modal (replaces permanent delete) ────────────────────────────────
function ArchiveModal({ teacher, onClose, onConfirm, loading }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 32, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="text-center mb-4">
          <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64, backgroundColor: '#fff3e0' }}>
            <i className="bi bi-archive-fill fs-2" style={{ color: '#d97706' }}></i>
          </div>
          <h5 className="fw-bold mb-1">Archive Teacher?</h5>
          <p className="small mb-0" style={{ color: '#555' }}>
            <strong>{teacher.full_name}</strong>'s account will be deactivated and moved to the
            Archived tab. Their record is kept and can be restored anytime — nothing is permanently deleted.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn flex-fill rounded-3 fw-medium text-white" style={{ backgroundColor: '#d97706' }} onClick={onConfirm} disabled={loading}>
            {loading ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-archive-fill me-1"></i>Yes, Archive</>}
          </button>
          <button className="btn btn-outline-secondary flex-fill rounded-3" onClick={onClose} disabled={loading}>Cancel</button>
        </div>
      </div>
    </>
  );
}

// ─── Restore Modal ─────────────────────────────────────────────────────────────
function RestoreModal({ teacher, onClose, onConfirm, loading }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 32, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="text-center mb-4">
          <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64, backgroundColor: '#e6f9f9' }}>
            <i className="bi bi-arrow-counterclockwise fs-2" style={{ color: '#008080' }}></i>
          </div>
          <h5 className="fw-bold mb-1">Restore Teacher?</h5>
          <p className="small mb-0" style={{ color: '#555' }}>
            <strong>{teacher.full_name}</strong>'s account will be reactivated and moved back to the active list.
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
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  const isSuccess = toast.type === 'success';
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, minWidth: 300, maxWidth: 420, backgroundColor: isSuccess ? '#e6f9f9' : '#fdecea', border: `1px solid ${isSuccess ? '#008080' : '#e53935'}`, borderRadius: 12, padding: '14px 18px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <i className={`bi ${isSuccess ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'} fs-5 mt-1`} style={{ color: isSuccess ? '#008080' : '#e53935', flexShrink: 0 }}></i>
      <div className="flex-fill">
        <p className="fw-semibold mb-0" style={{ fontSize: 14, color: isSuccess ? '#005f5f' : '#b71c1c' }}>{toast.message}</p>
        {toast.sub && <p className="mb-0 mt-1" style={{ fontSize: 12, color: '#444' }}>{toast.sub}</p>}
      </div>
      <button className="btn-close btn-close-sm" onClick={onClose}></button>
    </div>
  );
}

// ─── Password Reset Requests Panel ────────────────────────────────────────────
function ResetRequestsPanel({ requests, onSend, onDismiss, sendingId, dismissingId }) {
  if (requests.length === 0) return null;

  return (
    <div className="card border-0 shadow-sm rounded-4 mb-4" style={{ border: '1px solid #f59e0b !important' }}>
      <div className="card-body p-0">
        <div className="d-flex align-items-center gap-3 px-4 py-3" style={{ backgroundColor: '#fff8e1', borderRadius: '16px 16px 0 0', borderBottom: '1px solid #ffe082' }}>
          <div className="d-flex align-items-center justify-content-center rounded-3" style={{ width: 40, height: 40, backgroundColor: '#fef3c7', flexShrink: 0 }}>
            <i className="bi bi-key-fill" style={{ color: '#d97706', fontSize: 18 }}></i>
          </div>
          <div className="flex-fill">
            <h6 className="fw-bold mb-0" style={{ color: '#92400e' }}>
              Password Reset Requests
              <span className="badge rounded-pill ms-2" style={{ backgroundColor: '#d97706', fontSize: 11 }}>{requests.length}</span>
            </h6>
            <p className="small mb-0" style={{ fontSize: 12, color: '#78550a' }}>
              Teachers requesting a password reset. Click "Send Reset Link" to email them a link to set a new password.
            </p>
          </div>
        </div>

        <div className="px-4 py-2">
          {requests.map((req, i) => (
            <div
              key={req.id}
              className="d-flex align-items-center gap-3 py-3"
              style={{ borderBottom: i < requests.length - 1 ? '1px solid #f5f5f5' : 'none' }}
            >
              <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 40, height: 40, backgroundColor: '#fff3e0', flexShrink: 0 }}>
                <i className="bi bi-person-fill" style={{ color: '#d97706' }}></i>
              </div>
              <div className="flex-fill">
                <p className="fw-semibold mb-0" style={{ fontSize: 14 }}>{req.full_name}</p>
                <p className="mb-0" style={{ fontSize: 12, color: '#555' }}>{req.email}</p>
                {req.requested_at && (
                  <p className="mb-0" style={{ fontSize: 11, color: '#757575' }}>
                    Requested: {req.requested_at?.toDate ? req.requested_at.toDate().toLocaleString() : 'Just now'}
                  </p>
                )}
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm rounded-3 fw-medium"
                  style={{ backgroundColor: '#008080', color: '#fff', fontSize: 12 }}
                  onClick={() => onSend(req)}
                  disabled={sendingId === req.id}
                  title="Send password reset link to teacher's Gmail"
                >
                  {sendingId === req.id
                    ? <><span className="spinner-border spinner-border-sm me-1"></span>Sending...</>
                    : <><i className="bi bi-envelope-fill me-1"></i>Send Reset Link</>
                  }
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary rounded-3"
                  onClick={() => onDismiss(req)}
                  disabled={dismissingId === req.id}
                  title="Dismiss this request"
                >
                  {dismissingId === req.id
                    ? <span className="spinner-border spinner-border-sm"></span>
                    : <i className="bi bi-x-lg"></i>
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ManageTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [resetRequests, setResetRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [createdTeacher, setCreatedTeacher] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState(null);
  const [sendLoadingId, setSendLoadingId] = useState(null);
  const [resetSendingId, setResetSendingId] = useState(null);
  const [dismissingId, setDismissingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [view, setView] = useState('active'); // 'active' | 'archived'

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const snap = await getDocs(q);
    setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }, []);

  const fetchResetRequests = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reset-requests`);
      const data = await res.json();
      if (data.success) setResetRequests(data.data);
    } catch (err) {
      console.error('Failed to fetch reset requests:', err);
    }
  }, []);

  useEffect(() => {
    fetchTeachers();
    fetchResetRequests();
    const interval = setInterval(fetchResetRequests, 30000);
    return () => clearInterval(interval);
  }, [fetchTeachers, fetchResetRequests]);

  const displayName = (t) => t.full_name || buildFullName(t);

  const activeTeachers = teachers.filter((t) => t.status !== 'archived');
  const archivedTeachers = teachers.filter((t) => t.status === 'archived');
  const source = view === 'active' ? activeTeachers : archivedTeachers;

  const filtered = source.filter((t) =>
    displayName(t).toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.employee_no?.toLowerCase().includes(search.toLowerCase()) ||
    t.section_handled?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreated = (teacherData) => { setShowModal(false); setCreatedTeacher(teacherData); fetchTeachers(); };

  const doSendCredentials = async (uid) => {
    const res = await fetch(`${API_BASE}/api/teachers/${uid}/send-credentials`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data;
  };

  const handleSendFromModal = async () => {
    const teacher = teachers.find((t) => t.email === createdTeacher.email);
    if (!teacher) return;
    try { await doSendCredentials(teacher.id); }
    catch (err) { setToast({ type: 'error', message: 'Failed to send', sub: err.message }); }
  };

  const handleSendCredentials = async (teacher) => {
    setSendLoadingId(teacher.id);
    try {
      await doSendCredentials(teacher.id);
      setToast({ type: 'success', message: 'Credentials sent!', sub: `Username & password emailed to ${teacher.email}` });
    } catch (err) {
      setToast({ type: 'error', message: 'Send failed', sub: err.message });
    } finally { setSendLoadingId(null); }
  };

  const handleSendResetLink = async (req) => {
    setResetSendingId(req.id);
    try {
      const res = await fetch(`${API_BASE}/api/reset-requests/${req.id}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setToast({
        type: 'success',
        message: 'Reset link sent!',
        sub: `${req.email} received an email with a link to set a new password.`,
      });
      fetchResetRequests();
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to send reset link', sub: err.message });
    } finally { setResetSendingId(null); }
  };

  const handleDismissRequest = async (req) => {
    setDismissingId(req.id);
    try {
      const res = await fetch(`${API_BASE}/api/reset-requests/${req.id}/dismiss`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Dismiss failed');
      fetchResetRequests();
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to dismiss', sub: err.message });
    } finally { setDismissingId(null); }
  };

  const toggleStatus = async (teacher) => {
    const newStatus = teacher.status === 'active' ? 'deactivated' : 'active';
    setToggleLoadingId(teacher.id);
    try {
      const res = await fetch(`${API_BASE}/api/teachers/${teacher.id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Status update failed');
      fetchTeachers();
    } catch (err) { setToast({ type: 'error', message: 'Update failed', sub: err.message }); }
    finally { setToggleLoadingId(null); }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/teachers/${archiveTarget.id}/archive`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setToast({ type: 'success', message: 'Teacher archived', sub: `${displayName(archiveTarget)} was moved to Archived.` });
      setArchiveTarget(null);
      fetchTeachers();
    } catch (err) { setToast({ type: 'error', message: 'Archive failed', sub: err.message }); }
    finally { setActionLoading(false); }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/teachers/${restoreTarget.id}/restore`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setToast({ type: 'success', message: 'Teacher restored', sub: `${displayName(restoreTarget)} is active again.` });
      setRestoreTarget(null);
      fetchTeachers();
    } catch (err) { setToast({ type: 'error', message: 'Restore failed', sub: err.message }); }
    finally { setActionLoading(false); }
  };

  const activeCount = activeTeachers.filter((t) => t.status === 'active').length;
  const deactivatedCount = activeTeachers.filter((t) => t.status !== 'active').length;
  const archivedCount = archivedTeachers.length;

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="sv-shell">
        <Navbar title="Manage Teachers" />

        <div className="p-4 sv-page">

          {/* Stats */}
          <div className="row g-3 mb-4">
            {[
              { label: 'Total Teachers', value: teachers.length, icon: 'bi-people-fill', color: '#008080' },
              { label: 'Active', value: activeCount, icon: 'bi-person-check-fill', color: '#2E7D32' },
              { label: 'Deactivated', value: deactivatedCount, icon: 'bi-person-x-fill', color: '#c62828' },
              { label: 'Archived', value: archivedCount, icon: 'bi-archive-fill', color: '#d97706' },
            ].map((s, i) => (
              <div key={i} className="col-md-3 col-sm-6">
                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-body d-flex align-items-center gap-3 py-3">
                    <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, backgroundColor: `${s.color}18`, flexShrink: 0 }}>
                      <i className={`bi ${s.icon} fs-5`} style={{ color: s.color }}></i>
                    </div>
                    <div>
                      <p className="small mb-0" style={{ color: '#555' }}>{s.label}</p>
                      <h4 className="fw-bold mb-0" style={{ color: s.color }}>{s.value}</h4>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <ResetRequestsPanel
            requests={resetRequests}
            onSend={handleSendResetLink}
            onDismiss={handleDismissRequest}
            sendingId={resetSendingId}
            dismissingId={dismissingId}
          />

          {/* Tabs + Toolbar */}
          <div className="d-flex justify-content-between align-items-center mb-4 gap-3 flex-wrap">
            <div className="d-flex gap-2">
              <button
                className={`btn btn-sm rounded-pill ${view === 'active' ? 'text-white' : 'btn-outline-secondary'}`}
                style={view === 'active' ? { backgroundColor: '#008080' } : {}}
                onClick={() => setView('active')}
              >
                <i className="bi bi-people-fill me-1"></i>Active ({activeTeachers.length})
              </button>
              <button
                className={`btn btn-sm rounded-pill ${view === 'archived' ? 'text-white' : 'btn-outline-secondary'}`}
                style={view === 'archived' ? { backgroundColor: '#d97706' } : {}}
                onClick={() => setView('archived')}
              >
                <i className="bi bi-archive-fill me-1"></i>Archived ({archivedTeachers.length})
              </button>
            </div>
            <div className="input-group" style={{ maxWidth: 320 }}>
              <span className="input-group-text bg-white border-end-0"><i className="bi bi-search" style={{ color: '#555' }}></i></span>
              <input type="text" className="form-control border-start-0 ps-0 rounded-end-3" placeholder="Search name, email, employee no..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="d-flex align-items-center gap-3">
              <small style={{ color: '#555' }}>{filtered.length} teacher(s)</small>
              {view === 'active' && (
                <button className="btn rounded-3 fw-medium" style={{ backgroundColor: '#008080', color: '#fff' }} onClick={() => setShowModal(true)}>
                  <i className="bi bi-person-plus-fill me-2"></i>Create Teacher
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-0">
              {loading ? (
                <div className="p-3"><ListSkeleton rows={6} /></div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-4 py-3">#</th>
                        <th>Name</th>
                        <th>Email / Username</th>
                        <th>Employee No.</th>
                        <th>Section</th>
                        <th>Status</th>
                        <th className="pe-4 text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-5" style={{ color: '#555' }}>
                            <i className="bi bi-people fs-1 d-block mb-2 opacity-25"></i>
                            {view === 'active' ? 'No teacher accounts found' : 'No archived teachers'}
                          </td>
                        </tr>
                      ) : (
                        filtered.map((t, i) => (
                          <tr key={t.id}>
                            <td className="ps-4 small" style={{ color: '#555' }}>{i + 1}</td>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 36, height: 36, backgroundColor: '#00838A18', flexShrink: 0 }}>
                                  <i className="bi bi-person-fill" style={{ color: '#00838A' }}></i>
                                </div>
                                <span className="fw-medium">{displayName(t)}</span>
                              </div>
                            </td>
                            <td className="small" style={{ color: '#444' }}>{t.email}</td>
                            <td>
                              {t.employee_no
                                ? <span className="badge rounded-pill" style={{ backgroundColor: '#00838A18', color: '#00838A', fontWeight: 500, fontSize: 12 }}>{t.employee_no}</span>
                                : <span style={{ color: '#777' }}>—</span>}
                            </td>
                            <td className="small" style={{ color: '#444' }}>{t.section_handled || '—'}</td>
                            <td>
                              {t.status === 'archived' ? (
                                <span className="badge rounded-pill" style={{ backgroundColor: '#fff3e0', color: '#92400e', fontSize: 12 }}>
                                  <i className="bi bi-archive-fill me-1" style={{ fontSize: 10 }}></i>Archived
                                </span>
                              ) : (
                                <span className={`badge rounded-pill ${t.status === 'active' ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'}`} style={{ fontSize: 12 }}>
                                  <i className={`bi ${t.status === 'active' ? 'bi-circle-fill' : 'bi-circle'} me-1`} style={{ fontSize: 8 }}></i>
                                  {t.status === 'active' ? 'Active' : 'Deactivated'}
                                </span>
                              )}
                            </td>
                            <td className="pe-4">
                              <div className="d-flex justify-content-end gap-1 flex-wrap">
                                {view === 'active' ? (
                                  <>
                                    <button className={`btn btn-sm rounded-3 ${t.status === 'active' ? 'btn-outline-secondary' : 'btn-outline-success'}`} onClick={() => toggleStatus(t)} disabled={toggleLoadingId === t.id} title={t.status === 'active' ? 'Deactivate' : 'Activate'}>
                                      {toggleLoadingId === t.id ? <span className="spinner-border spinner-border-sm"></span> : <i className={`bi ${t.status === 'active' ? 'bi-person-dash-fill' : 'bi-person-check-fill'}`}></i>}
                                    </button>
                                    <button className="btn btn-sm rounded-3 fw-medium d-flex align-items-center gap-1" style={{ backgroundColor: '#008080', color: '#fff', fontSize: 12 }} onClick={() => handleSendCredentials(t)} disabled={sendLoadingId === t.id} title="Send username & password to Gmail">
                                      {sendLoadingId === t.id ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-envelope-fill"></i><span>Send</span></>}
                                    </button>
                                    <button className="btn btn-sm rounded-3" style={{ backgroundColor: '#fff3e0', color: '#d97706' }} onClick={() => setArchiveTarget(t)} title="Archive teacher">
                                      <i className="bi bi-archive-fill"></i>
                                    </button>
                                  </>
                                ) : (
                                  <button className="btn btn-sm rounded-3 fw-medium d-flex align-items-center gap-1" style={{ backgroundColor: '#008080', color: '#fff', fontSize: 12 }} onClick={() => setRestoreTarget(t)} title="Restore teacher">
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

      {showModal && <CreateTeacherModal onClose={() => setShowModal(false)} onSuccess={handleCreated} />}
      {createdTeacher && <AccountCreatedModal teacher={createdTeacher} onClose={() => setCreatedTeacher(null)} onSendNow={handleSendFromModal} />}
      {archiveTarget && <ArchiveModal teacher={{ ...archiveTarget, full_name: displayName(archiveTarget) }} onClose={() => setArchiveTarget(null)} onConfirm={handleArchive} loading={actionLoading} />}
      {restoreTarget && <RestoreModal teacher={{ ...restoreTarget, full_name: displayName(restoreTarget) }} onClose={() => setRestoreTarget(null)} onConfirm={handleRestore} loading={actionLoading} />}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
