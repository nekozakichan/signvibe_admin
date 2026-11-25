import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../../api/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import { ListSkeleton } from '../../components/Skeletons';
import { apiFetch } from '../../config/api';
import { buildFullName } from '../../utils/name';
import { normalizeEmail, isValidEmail, INVALID_EMAIL_MESSAGE } from '../../utils/email';
import { watchSchoolYears } from '../../config/schoolYears';
import {
  ENROLLMENT_STATUSES,
  GRADUATE_CHOICE,
  GRADUATED,
  loadEnrollmentsForYear,
  retrieveByDefault,
  statusInfo,
  suggestedNextGrade,
} from '../../config/enrollments';

// Same rule as the backend: a PH mobile number, stored as 09XXXXXXXXX.
function normalizePhMobile(raw) {
  const digits = String(raw || '').replace(/[\s\-().]/g, '').replace(/^\+/, '');
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return '0' + digits.slice(2);
  return null;
}


// ─── Add Student Modal ────────────────────────────────────────────────────────
function AddStudentModal({ schoolYear, onClose, onSuccess }) {
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '',
    email: '', grade_level: '', parent_name: '', parent_contact: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    const { first_name, last_name, email, grade_level, parent_name, parent_contact } = form;
    if (!first_name.trim() || !last_name.trim() || !email.trim() || !grade_level || !parent_name.trim() || !parent_contact.trim()) {
      setError("First name, last name, email, grade, and the parent's name and contact number are required.");
      return;
    }
    if (!isValidEmail(email)) {
      setError(INVALID_EMAIL_MESSAGE);
      return;
    }
    const parentContact = normalizePhMobile(parent_contact);
    if (!parentContact) {
      setError("Parent's contact number must be a valid PH mobile number, e.g. 09171234567.");
      return;
    }
    const cleanEmail = normalizeEmail(email);
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, email: cleanEmail, parent_name: parent_name.trim(), parent_contact: parentContact, school_year_id: schoolYear?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create student.');
      onSuccess({ ...form, email: cleanEmail, full_name: buildFullName(form) });
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
            <p className="small mb-0 mt-1" style={{ color: '#555' }}>
              Create a student account{schoolYear ? <> and enroll them in <strong style={{ color: '#008080' }}>S.Y. {schoolYear.schoolYear}</strong></> : ''}.
              You can send the credentials to their Gmail after.
            </p>
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
            <span className="ms-1" style={{ fontSize: 11, color: '#777' }}>(The student logs in with this email)</span>
          </label>
          <input name="email" type="email" className="form-control rounded-3" placeholder="student@gmail.com" value={form.email} onChange={handleChange} />
        </div>

        <div className="mb-3">
          <label className="form-label fw-medium small">Grade Level</label>
          <select name="grade_level" className="form-select rounded-3" value={form.grade_level} onChange={handleChange}>
            <option value="">-- Select Grade --</option>
            {[1,2,3,4,5,6].map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </div>

        <div className="mb-3">
          <label className="form-label fw-medium small">Parent's / Guardian's Name</label>
          <div className="input-group">
            <span className="input-group-text bg-white rounded-start-3"><i className="bi bi-person-hearts" style={{ color: '#008080' }}></i></span>
            <input
              name="parent_name"
              type="text"
              maxLength={100}
              className="form-control rounded-end-3"
              placeholder="e.g. Maria Dela Cruz"
              value={form.parent_name}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label fw-medium small">Parent's Contact Number</label>
          <div className="input-group">
            <span className="input-group-text bg-white rounded-start-3"><i className="bi bi-telephone-fill" style={{ color: '#008080' }}></i></span>
            <input
              name="parent_contact"
              type="tel"
              inputMode="tel"
              maxLength={16}
              className="form-control rounded-end-3"
              placeholder="e.g. 09171234567"
              value={form.parent_contact}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="mb-4 p-3 rounded-3 d-flex align-items-start gap-2" style={{ backgroundColor: '#f0fafa', border: '1px solid #b2dfdb' }}>
          <i className="bi bi-shield-lock-fill mt-1" style={{ color: '#008080' }}></i>
          <p className="mb-0" style={{ fontSize: 12, color: '#555' }}>
            A secure password is generated automatically and stored encrypted. It is never shown here —
            use the <strong>"Send Credentials"</strong> button to email it to the student's Gmail anytime.
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
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

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

        <p className="small mb-4" style={{ color: '#555' }}>
          Do you want to send the login credentials to <strong>{student.email}</strong> right now?
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
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const presets = ['Transferred to another school', 'Completed Grade 6', 'No longer enrolled', 'Long-term absence', 'Duplicate account'];

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (!trimmed) { setError('Please give a reason — it will be emailed to the student.'); return; }
    setError('');
    onConfirm(trimmed);
  };

  return (
    <>
      <div onClick={loading ? undefined : onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 480, backgroundColor: '#fff', borderRadius: 16, padding: 32, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
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

        <div className="mb-3">
          <label className="form-label fw-medium small mb-1">Reason for archiving</label>
          <div className="d-flex flex-wrap gap-1 mb-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                className="btn btn-sm rounded-pill"
                style={{ fontSize: 12, backgroundColor: reason === p ? '#d97706' : '#fff3e0', color: reason === p ? '#fff' : '#9a5b05', border: 'none' }}
                onClick={() => { setReason(p); setError(''); }}
                disabled={loading}
              >
                {p}
              </button>
            ))}
          </div>
          <textarea
            className={`form-control rounded-3 ${error ? 'is-invalid' : ''}`}
            rows={3}
            maxLength={500}
            placeholder="Pick one above or write your own message…"
            value={reason}
            onChange={(e) => { setReason(e.target.value); if (error) setError(''); }}
            disabled={loading}
          />
          {error && <div className="invalid-feedback d-block">{error}</div>}
          <div className="d-flex justify-content-between mt-1" style={{ fontSize: 11, color: '#666' }}>
            <span><i className="bi bi-envelope me-1"></i>This message will be emailed to <strong>{student.email}</strong>.</span>
            <span>{reason.length}/500</span>
          </div>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-danger flex-fill rounded-3 fw-medium text-white" style={{ backgroundColor: '#d97706', borderColor: '#d97706' }} onClick={handleConfirm} disabled={loading}>
            {loading ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-archive-fill me-1"></i>Archive &amp; Send</>}
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

// ─── Edit Student ─────────────────────────────────────────────────────────────
function EditStudentModal({ student, activeYear, onClose, onSaved }) {
  const [form, setForm] = useState({
    first_name: student.first_name || '',
    middle_name: student.middle_name || '',
    last_name: student.last_name || '',
    email: student.email || '',
    grade_level: String(student.grade_level || ''),
    parent_name: student.parent_name || '',
    parent_contact: student.parent_contact || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const change = (e) => { setForm((p) => ({ ...p, [e.target.name]: e.target.value })); setError(''); };
  const emailChanged = form.email.trim().toLowerCase() !== String(student.email || '').toLowerCase();

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim() || !form.grade_level || !form.parent_contact.trim()) {
      setError("First name, last name, email, grade, and parent's contact number are required.");
      return;
    }
    if (!isValidEmail(form.email)) { setError(INVALID_EMAIL_MESSAGE); return; }
    const parentContact = normalizePhMobile(form.parent_contact);
    if (!parentContact) { setError("Parent's contact number must be a valid PH mobile number, e.g. 09171234567."); return; }
    setSaving(true); setError('');
    try {
      const res = await apiFetch(`/api/students/${student.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...form, parent_name: form.parent_name.trim(), parent_contact: parentContact }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not save.');
      onSaved(data.message);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div onClick={saving ? undefined : onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }} />
      <div role="dialog" aria-modal="true" aria-label="Edit student" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'calc(100% - 32px)', maxWidth: 520, backgroundColor: '#fff', borderRadius: 16, padding: 28, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="d-flex justify-content-between align-items-start mb-3">
          <h5 className="fw-bold mb-0" style={{ color: '#008080' }}><i className="bi bi-pencil-square me-2"></i>Edit Student</h5>
          {!saving && <button className="btn-close" onClick={onClose} aria-label="Close"></button>}
        </div>
        {error && <div className="alert alert-danger py-2 small rounded-3"><i className="bi bi-exclamation-circle me-1"></i>{error}</div>}
        <div className="row g-2 mb-3">
          {[['first_name', 'First Name'], ['middle_name', 'Middle Name'], ['last_name', 'Last Name']].map(([name, label]) => (
            <div className="col-md-4" key={name}>
              <label className="form-label fw-medium small" htmlFor={`sv-edit-${name}`}>{label}{name === 'middle_name' && <span style={{ color: '#777', fontSize: 11 }}> (optional)</span>}</label>
              <input id={`sv-edit-${name}`} name={name} className="form-control rounded-3" value={form[name]} onChange={change} disabled={saving} />
            </div>
          ))}
        </div>
        <div className="mb-3">
          <label className="form-label fw-medium small" htmlFor="sv-edit-email">Email Address <span style={{ color: '#777', fontSize: 11 }}>(used to log in)</span></label>
          <input id="sv-edit-email" name="email" type="email" className="form-control rounded-3" value={form.email} onChange={change} disabled={saving} />
          {emailChanged && (
            <div className="small mt-1" style={{ color: '#B26A00' }}>
              <i className="bi bi-exclamation-triangle me-1"></i>The student will log in with the new email. Their password stays the same.
            </div>
          )}
        </div>
        <div className="mb-3">
          <label className="form-label fw-medium small" htmlFor="sv-edit-grade">Grade Level{activeYear && <span style={{ color: '#777', fontSize: 11 }}> (S.Y. {activeYear.schoolYear})</span>}</label>
            <select id="sv-edit-grade" name="grade_level" className="form-select rounded-3" style={{ maxWidth: 220 }} value={form.grade_level} onChange={change} disabled={saving}>
              {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
        </div>
        <div className="row g-2">
          <div className="col-md-7">
            <label className="form-label fw-medium small" htmlFor="sv-edit-parent-name">Parent's / Guardian's Name</label>
            <input id="sv-edit-parent-name" name="parent_name" type="text" maxLength={100} className="form-control rounded-3" value={form.parent_name} onChange={change} disabled={saving} placeholder="e.g. Maria Dela Cruz" />
            {!student.parent_name && !form.parent_name.trim() && (
              <small style={{ color: '#9a5b05', fontSize: 11 }}><i className="bi bi-info-circle me-1"></i>Not set yet — add it so it shows on the student's details.</small>
            )}
          </div>
          <div className="col-md-5">
            <label className="form-label fw-medium small" htmlFor="sv-edit-parent">Parent's Contact Number</label>
            <input id="sv-edit-parent" name="parent_contact" type="tel" className="form-control rounded-3" value={form.parent_contact} onChange={change} disabled={saving} placeholder="e.g. 09171234567" />
          </div>
        </div>
        <div className="d-flex gap-2 mt-4">
          <button className="btn flex-fill rounded-3 fw-medium text-white" style={{ backgroundColor: '#008080' }} onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner-border spinner-border-sm"></span> : 'Save Changes'}
          </button>
          <button className="btn btn-outline-secondary rounded-3" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Retrieve students from a previous school year ────────────────────────────
function RetrieveModal({ years, targetYear, usersById, alreadyEnrolled, onClose, onDone }) {
  const sources = years.filter((y) => y.startYear < targetYear.startYear);
  const [sourceId, setSourceId] = useState(sources[0]?.id || '');
  const [rows, setRows] = useState(null);            // enrollment records of the source year
  const [picked, setPicked] = useState({});          // uid -> { on, grade } (grade: 1–6 or GRADUATE_CHOICE)
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sendCongrats, setSendCongrats] = useState(true);

  useEffect(() => {
    if (!sourceId) return;
    let alive = true;
    setRows(null);
    loadEnrollmentsForYear(sourceId).then((list) => {
      if (!alive) return;
      const name = (r) => usersById[r.student_id]?.full_name || r.student_name || '';
      const sorted = list.sort((a, b) => (Number(a.grade_level) - Number(b.grade_level)) || name(a).localeCompare(name(b)));
      setRows(sorted);
      const init = {};
      sorted.forEach((r) => {
        const blocked = alreadyEnrolled.has(r.student_id) || usersById[r.student_id]?.status === 'archived' || !usersById[r.student_id];
        init[r.student_id] = { on: !blocked && retrieveByDefault(r, usersById[r.student_id]), grade: suggestedNextGrade(r) };
      });
      setPicked(init);
    }).catch((err) => { if (alive) { setRows([]); setError('Could not load that school year: ' + err.message); } });
    return () => { alive = false; };
  }, [sourceId, alreadyEnrolled, usersById]);

  // Current account name (an old record keeps the name from that year).
  const nameOf = (r) => usersById[r.student_id]?.full_name || r.student_name || '';

  const blockedReason = (r) => {
    const u = usersById[r.student_id];
    if (!u) return 'Account no longer exists';
    if (alreadyEnrolled.has(r.student_id)) return `Already in S.Y. ${targetYear.schoolYear}`;
    if (u.status === 'archived') return 'Account archived — restore it first';
    if (r.status === GRADUATED) return 'Graduated 🎓';
    return '';
  };
  const visible = (rows || []).filter((r) => nameOf(r).toLowerCase().includes(search.toLowerCase()));
  const chosen = (rows || []).filter((r) => picked[r.student_id]?.on && !blockedReason(r));
  const setAll = (on) => setPicked((p) => {
    const next = { ...p };
    visible.forEach((r) => { if (!blockedReason(r)) next[r.student_id] = { ...next[r.student_id], on }; });
    return next;
  });

  const graduating = chosen.filter((r) => picked[r.student_id].grade === GRADUATE_CHOICE);
  const retrieving = chosen.length - graduating.length;
  // Students who get a congratulations email: graduating, or moving up a grade
  // from a record that is still just "enrolled" (the backend closes it as promoted).
  const congratsCount = graduating.length + chosen.filter((r) => {
    const g = picked[r.student_id].grade;
    return g !== GRADUATE_CHOICE && g > Number(r.grade_level) && r.status === 'enrolled';
  }).length;
  const actionLabel = [
    retrieving > 0 || graduating.length === 0 ? `Retrieve ${retrieving} student${retrieving === 1 ? '' : 's'}` : '',
    graduating.length > 0 ? `Graduate ${graduating.length}` : '',
  ].filter(Boolean).join(' · ');

  const handleRetrieve = async () => {
    if (chosen.length === 0) { setError('Tick at least one student.'); return; }
    setSaving(true); setError('');
    try {
      const res = await apiFetch('/api/enrollments', {
        method: 'POST',
        body: JSON.stringify({
          school_year_id: targetYear.id,
          from_school_year_id: sourceId,
          send_congrats: sendCongrats,
          entries: chosen.map((r) => (picked[r.student_id].grade === GRADUATE_CHOICE
            ? { uid: r.student_id, graduate: true }
            : { uid: r.student_id, grade_level: picked[r.student_id].grade })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not retrieve students.');
      onDone(data);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const source = sources.find((y) => y.id === sourceId);
  return createPortal(
    <>
      <div onClick={saving ? undefined : onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }} />
      <div role="dialog" aria-modal="true" aria-label="Retrieve students" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'calc(100% - 32px)', maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', borderRadius: 16, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="p-4 pb-3 border-bottom">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h5 className="fw-bold mb-1" style={{ color: '#008080' }}><i className="bi bi-box-arrow-in-down me-2"></i>Retrieve Students into S.Y. {targetYear.schoolYear}</h5>
              <p className="small mb-0" style={{ color: '#555' }}>Copy students from a previous school year — no re-encoding. Choose each student's grade for S.Y. {targetYear.schoolYear}. Grade 6 students graduate unless you keep them in Grade 6.</p>
            </div>
            {!saving && <button className="btn-close" onClick={onClose} aria-label="Close"></button>}
          </div>
          {sources.length > 0 && (
            <div className="d-flex flex-wrap gap-2 align-items-center mt-3">
              <label className="small fw-medium" htmlFor="sv-ret-from">From</label>
              <select id="sv-ret-from" className="form-select form-select-sm rounded-3" style={{ width: 'auto' }} value={sourceId} onChange={(e) => setSourceId(e.target.value)} disabled={saving}>
                {sources.map((y) => <option key={y.id} value={y.id}>S.Y. {y.schoolYear}</option>)}
              </select>
              <input className="form-control form-control-sm rounded-3" style={{ maxWidth: 220 }} placeholder="Search name…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students to retrieve" />
              <div className="ms-auto d-flex gap-1">
                <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setAll(true)} disabled={saving}>Select all</button>
                <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setAll(false)} disabled={saving}>Clear</button>
              </div>
            </div>
          )}
        </div>

        <div className="p-3" style={{ overflowY: 'auto' }}>
          {error && <div className="alert alert-danger py-2 small rounded-3"><i className="bi bi-exclamation-circle me-1"></i>{error}</div>}
          {sources.length === 0 ? (
            <div className="text-center py-4 px-3" style={{ color: '#555' }}>
              <i className="bi bi-calendar-x fs-1 d-block mb-2 opacity-25"></i>
              <p className="mb-2"><strong>S.Y. {targetYear.schoolYear}</strong> is the earliest school year, so there's nothing to retrieve from yet.</p>
              <p className="small mb-0">
                Retrieving copies students from an <em>earlier</em> school year into a newer one. When the next school year
                is added by the admin (for example S.Y. {targetYear.startYear + 1}-{targetYear.startYear + 2}), choose it in the
                School Year dropdown and retrieve your students from S.Y. {targetYear.schoolYear}.
              </p>
            </div>
          ) : rows === null ? (
            <div className="text-center py-5"><div className="spinner-border" style={{ color: '#00838A' }}></div></div>
          ) : rows.length === 0 ? (
            <p className="text-center py-4 mb-0" style={{ color: '#555' }}>No students were enrolled in S.Y. {source?.schoolYear}.</p>
          ) : (
            <table className="table table-sm align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>Student</th>
                  <th>S.Y. {source?.schoolYear}</th>
                  <th>Grade in S.Y. {targetYear.schoolYear}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const reason = blockedReason(r);
                  const p = picked[r.student_id] || {};
                  const st = statusInfo(r.status);
                  return (
                    <tr key={r.id} style={reason ? { opacity: 0.55 } : undefined}>
                      <td>
                        <input type="checkbox" className="form-check-input" checked={!reason && !!p.on} disabled={!!reason || saving}
                          onChange={(e) => setPicked((x) => ({ ...x, [r.student_id]: { ...x[r.student_id], on: e.target.checked } }))}
                          aria-label={`Retrieve ${nameOf(r)}`} />
                      </td>
                      <td>
                        <div className="fw-medium">{nameOf(r)}</div>
                        {reason && <div className="small" style={{ color: '#999' }}>{reason}</div>}
                      </td>
                      <td className="small text-nowrap">
                        Grade {r.grade_level} · <span style={{ color: st.color }}>{st.label}</span>
                      </td>
                      <td>
                        <select className="form-select form-select-sm rounded-3"
                          style={{ width: 'auto', ...(p.grade === GRADUATE_CHOICE && !reason ? { color: '#6A1B9A', fontWeight: 600 } : {}) }}
                          value={p.grade || ''} disabled={!!reason || saving || !p.on}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPicked((x) => ({ ...x, [r.student_id]: { ...x[r.student_id], grade: v === GRADUATE_CHOICE ? v : Number(v) } }));
                          }}
                          aria-label={`New grade for ${nameOf(r)}`}>
                          {Number(r.grade_level) >= 6 ? (
                            <>
                              <option value={GRADUATE_CHOICE}>🎓 Graduate</option>
                              <option value={6}>Grade 6 (retained)</option>
                            </>
                          ) : [1, 2, 3, 4, 5, 6].map((g) => (
                            <option key={g} value={g}>
                              Grade {g}{g > Number(r.grade_level) ? ' (promoted)' : g === Number(r.grade_level) ? ' (retained)' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="d-flex flex-wrap gap-2 p-4 pt-3 border-top align-items-center">
          {sources.length > 0 && (
            <div className="d-flex flex-column">
              <span className="small" style={{ color: '#555' }}>{chosen.length} selected</span>
              <div className="form-check small mb-0">
                <input id="sv-ret-congrats" type="checkbox" className="form-check-input" checked={sendCongrats}
                  onChange={(e) => setSendCongrats(e.target.checked)} disabled={saving} />
                <label className="form-check-label" htmlFor="sv-ret-congrats" style={{ color: '#555' }}>
                  Email a congratulations to promoted and graduated students{congratsCount > 0 ? ` (${congratsCount})` : ''}
                </label>
              </div>
            </div>
          )}
          <button className="btn btn-outline-secondary rounded-3 ms-auto" onClick={onClose} disabled={saving}>{sources.length > 0 ? 'Cancel' : 'Close'}</button>
          {sources.length > 0 && <button className="btn rounded-3 fw-medium text-white" style={{ backgroundColor: '#008080' }} onClick={handleRetrieve} disabled={saving || chosen.length === 0}>
            {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving…</> : <><i className="bi bi-box-arrow-in-down me-2"></i>{actionLabel}</>}
          </button>}
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StudentsList() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);           // every student account
  const [years, setYears] = useState(undefined);          // school years (admin-managed)
  const [selectedYearId, setSelectedYearId] = useState(null);
  const [enrollments, setEnrollments] = useState([]);     // enrollments of the selected year
  const [laterEnrolledIds, setLaterEnrolledIds] = useState(() => new Set()); // already in a later school year
  const [finishedIds, setFinishedIds] = useState(() => new Set());          // graduated / transferred / dropped before
  // Which school year `enrollments` and `laterEnrolledIds` were loaded for.
  // Until it matches the selected year, the data on hand belongs to the year
  // the user just left, so the table and the "not enrolled" banner wait.
  const [enrollmentsYearId, setEnrollmentsYearId] = useState(null);
  const enrollmentsRequest = useRef(0);
  const [lessonsCompletedMap, setLessonsCompletedMap] = useState({});
  const [pointsMap, setPointsMap] = useState({});
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [createdStudent, setCreatedStudent] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [showRetrieve, setShowRetrieve] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sendLoadingId, setSendLoadingId] = useState(null);
  const [statusSavingId, setStatusSavingId] = useState(null);
  const [enrollingAll, setEnrollingAll] = useState(false);
  const [toast, setToast] = useState(null);
  const [view, setView] = useState('enrolled'); // 'enrolled' | 'archived'

  // School years, live — the active one is the default selection.
  useEffect(() => watchSchoolYears(setYears, () => setYears([])), []);
  const activeYear = years?.find((y) => y.isActive) || null;
  useEffect(() => {
    if (selectedYearId === null && years !== undefined) setSelectedYearId(activeYear?.id || '');
  }, [years, activeYear, selectedYearId]);
  const selectedYear = years?.find((y) => y.id === selectedYearId) || null;
  const isPastYear = !!(selectedYear && activeYear && selectedYear.startYear < activeYear.startYear);
  const canEnroll = !!selectedYear && !isPastYear;   // active or upcoming year

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

  const selectedStartYear = selectedYear?.startYear;
  const fetchEnrollments = useCallback(async () => {
    const yearId = selectedYearId;
    // Numbered so a slow reply for a year the user already left can't
    // overwrite the year they switched to.
    const request = ++enrollmentsRequest.current;
    if (!yearId) {
      setEnrollments([]); setLaterEnrolledIds(new Set()); setFinishedIds(new Set()); setEnrollmentsYearId(yearId);
      return;
    }
    try {
      // Both lists are loaded together and applied in one step. Applying them
      // one after the other left a moment where this year's enrollments sat
      // next to the previous year's "later" list, so students enrolled only in
      // a later year flashed in the "not enrolled" banner.
      const hasStart = Number.isFinite(selectedStartYear);
      const [yearEnrollments, laterIds, doneIds] = await Promise.all([
        loadEnrollmentsForYear(yearId),
        // Students already enrolled in a later school year (e.g. added while
        // that year was active) are not "missing" from this one.
        hasStart
          ? getDocs(query(collection(db, 'enrollments'), where('start_year', '>', selectedStartYear)))
              .then((later) => new Set(later.docs.map((d) => d.data().student_id)))
          : Promise.resolve(new Set()),
        // Students whose latest earlier enrollment ended for good — graduated,
        // transferred or dropped — are not "missing" from this year either.
        // Read from the records themselves, so it works however the status
        // was set (Retrieve, the status dropdown, or older data).
        hasStart
          ? getDocs(query(collection(db, 'enrollments'), where('start_year', '<', selectedStartYear)))
              .then((earlier) => {
                const latest = new Map();
                earlier.docs.forEach((d) => {
                  const e = d.data();
                  const prev = latest.get(e.student_id);
                  if (!prev || Number(e.start_year) > Number(prev.start_year)) latest.set(e.student_id, e);
                });
                return new Set([...latest.values()]
                  .filter((e) => [GRADUATED, 'transferred', 'dropped'].includes(e.status))
                  .map((e) => e.student_id));
              })
          : Promise.resolve(new Set()),
      ]);
      if (request !== enrollmentsRequest.current) return;
      setEnrollments(yearEnrollments);
      setLaterEnrolledIds(laterIds);
      setFinishedIds(doneIds);
      setEnrollmentsYearId(yearId);
    } catch (err) {
      if (request !== enrollmentsRequest.current) return;
      setEnrollments([]);
      setLaterEnrolledIds(new Set());
      setFinishedIds(new Set());
      setEnrollmentsYearId(yearId);
      setToast({ type: 'error', message: 'Could not load enrollments', sub: err.code === 'permission-denied' ? 'Deploy the updated Firestore rules (firebase deploy --only firestore:rules), then refresh.' : err.message });
    }
  }, [selectedYearId, selectedStartYear]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);
  const refreshAll = () => { fetchStudents(); fetchEnrollments(); };

  const displayName = (s) => s.full_name || buildFullName(s);
  // True while switching years: the enrollments on hand are for another year.
  const switchingYear = selectedYearId !== null && enrollmentsYearId !== selectedYearId;
  const usersById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);
  const enrolledIds = useMemo(() => new Set(enrollments.map((e) => e.student_id)), [enrollments]);

  // Rows for the selected school year: each enrollment joined with its account.
  const enrolledRows = enrollments.map((e) => {
    const u = usersById[e.student_id];
    return {
      ...(u || {}),
      id: e.student_id,
      full_name: u ? displayName(u) : e.student_name,
      email: u?.email || e.student_email,
      grade_level: e.grade_level,              // that year's grade
      enrollment: e,
      accountArchived: u?.status === 'archived',
      missingAccount: !u,
    };
  });
  const archivedStudents = students.filter((s) => s.status === 'archived');
  // No school years set up yet: fall back to the plain account list.
  const legacyMode = years !== undefined && years.length === 0;
  const source = legacyMode
    ? (view === 'archived' ? archivedStudents : students.filter((s) => s.status !== 'archived'))
    : (view === 'archived' ? archivedStudents : enrolledRows);

  // Active-year accounts with no enrollment yet (created before enrollments
  // existed). Students already enrolled in a later school year don't count.
  const notEnrolled = selectedYear?.isActive
    ? students.filter((s) => s.status !== 'archived' && !s.graduated_school_year
        && !enrolledIds.has(s.id) && !laterEnrolledIds.has(s.id) && !finishedIds.has(s.id))
    : [];

  const grades = [...new Set(source.map((s) => s.grade_level).filter(Boolean))].sort((a, b) => Number(a) - Number(b));

  const filtered = source
    .filter((s) => {
      const q = search.toLowerCase();
      const matchName = displayName(s).toLowerCase().includes(q) || String(s.email || '').toLowerCase().includes(q);
      const matchGrade = !filterGrade || String(s.grade_level) === filterGrade;
      const matchStatus = !filterStatus || s.enrollment?.status === filterStatus;
      return matchName && matchGrade && matchStatus;
    })
    .sort((a, b) => (Number(a.grade_level) - Number(b.grade_level)) || displayName(a).localeCompare(displayName(b)));

  const handleCreated = (studentData) => {
    setShowModal(false);
    setCreatedStudent(studentData);
    refreshAll();
  };

  const doSendCredentials = async (uid) => {
    const res = await apiFetch(`/api/students/${uid}/send-credentials`, { method: 'POST' });
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
      setToast({ type: 'success', message: 'Credentials sent!', sub: `Login email & password sent to ${student.email}` });
    } catch (err) {
      setToast({ type: 'error', message: 'Send failed', sub: err.message });
    } finally {
      setSendLoadingId(null);
    }
  };

  const handleArchive = async (reason) => {
    if (!archiveTarget) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/students/${archiveTarget.id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setToast(data.emailSent
        ? { type: 'success', message: 'Student archived', sub: `${displayName(archiveTarget)} was moved to Archived and the reason was emailed to ${archiveTarget.email}.` }
        : { type: 'error', message: 'Archived, but email not sent', sub: data.message });
      setArchiveTarget(null);
      refreshAll();
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
      const res = await apiFetch(`/api/students/${restoreTarget.id}/restore`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setToast({ type: 'success', message: 'Student restored', sub: `${displayName(restoreTarget)} is active again.` });
      setRestoreTarget(null);
      refreshAll();
    } catch (err) {
      setToast({ type: 'error', message: 'Restore failed', sub: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (row, status) => {
    // Promoting or graduating emails the student a congratulations (once).
    const congrats = ['promoted', GRADUATED].includes(status) && !row.enrollment.congrats_sent_at;
    if (congrats && !window.confirm(
      `Mark ${row.full_name} as ${statusInfo(status).label}?\n\nA congratulations email will be sent to ${row.email}.`
    )) return;
    setStatusSavingId(row.enrollment.id);
    try {
      const res = await apiFetch(`/api/enrollments/${row.enrollment.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const sentAt = data.email?.sent ? new Date().toISOString() : null;
      setEnrollments((list) => list.map((e) => (e.id === row.enrollment.id
        ? { ...e, status, ...(sentAt ? { congrats_sent_at: sentAt } : {}) }
        : e)));
      // Keep the account's graduated mark in step locally (the banner reads it).
      setStudents((list) => list.map((u) => (u.id !== row.id ? u
        : status === GRADUATED ? { ...u, graduated_school_year: selectedYear.schoolYear }
        : row.enrollment.status === GRADUATED ? { ...u, graduated_school_year: null } : u)));
      const emailNote = data.email?.sent ? ` Congratulations emailed to ${row.email}.`
        : data.email ? ` The congratulations email could not be sent (${data.email.reason}).` : '';
      setToast({
        type: data.email && !data.email.sent ? 'error' : 'success',
        message: 'Enrollment updated',
        sub: `${row.full_name} — ${statusInfo(status).label} (S.Y. ${selectedYear.schoolYear}).${emailNote}`,
      });
    } catch (err) {
      setToast({ type: 'error', message: 'Update failed', sub: err.message });
    } finally {
      setStatusSavingId(null);
    }
  };

  const handleEnrollCurrent = async () => {
    if (!window.confirm(`Enroll ${notEnrolled.length} student${notEnrolled.length === 1 ? '' : 's'} into S.Y. ${selectedYear.schoolYear} with their current grade?`)) return;
    setEnrollingAll(true);
    try {
      const res = await apiFetch('/api/enrollments/enroll-current', { method: 'POST', body: JSON.stringify({ school_year_id: selectedYear.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setToast({ type: 'success', message: 'Students enrolled', sub: `${data.enrolled} student${data.enrolled === 1 ? '' : 's'} enrolled in S.Y. ${data.schoolYear}.` });
      fetchEnrollments();
    } catch (err) {
      setToast({ type: 'error', message: 'Enroll failed', sub: err.message });
    } finally {
      setEnrollingAll(false);
    }
  };

  const yearLabel = (y) => `S.Y. ${y.schoolYear}${y.isActive ? ' (Active)' : activeYear && y.startYear < activeYear.startYear ? ' (Previous)' : activeYear ? ' (Upcoming)' : ''}`;
  const colCount = isPastYear ? 6 : 8;

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="sv-shell">
        <Navbar title="Students List" />

        <div className="p-4 sv-page">

          {/* School Year selection */}
          {years && years.length > 0 && (
            <div className="card border-0 shadow-sm rounded-4 mb-3" style={{ borderLeft: `4px solid ${isPastYear ? '#6c757d' : '#008080'}` }}>
              <div className="card-body py-3 px-4 d-flex flex-wrap align-items-center gap-3">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-calendar3" style={{ color: '#008080' }}></i>
                  <label className="small fw-semibold mb-0" htmlFor="sv-sy-select">School Year</label>
                  <select id="sv-sy-select" className="form-select form-select-sm rounded-3" style={{ width: 'auto' }}
                    value={selectedYearId || ''} onChange={(e) => { setSelectedYearId(e.target.value); setView('enrolled'); setFilterGrade(''); setFilterStatus(''); }}>
                    {years.map((y) => <option key={y.id} value={y.id}>{yearLabel(y)}</option>)}
                  </select>
                </div>
                <div className="small" style={{ color: '#555' }}>
                  {activeYear ? <>Current active school year: <strong style={{ color: '#008080' }}>S.Y. {activeYear.schoolYear}</strong></> : 'No school year is active — ask the admin to activate one.'}
                </div>
                {isPastYear && (
                  <span className="badge rounded-pill ms-auto" style={{ backgroundColor: '#eee', color: '#555', fontWeight: 500 }}>
                    <i className="bi bi-clock-history me-1"></i>Previous school year — viewing records
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Not-yet-enrolled notice (active year) */}
          {!legacyMode && view === 'enrolled' && notEnrolled.length > 0 && !loading && !switchingYear && (
            <div className="alert rounded-4 d-flex flex-wrap align-items-center gap-2 small" style={{ backgroundColor: '#fff8e1', border: '1px solid #ffe082', color: '#78550a' }}>
              <i className="bi bi-info-circle-fill"></i>
              <span className="flex-fill">
                <strong>{notEnrolled.length}</strong> student account{notEnrolled.length === 1 ? ' is' : 's are'} not enrolled in S.Y. {selectedYear.schoolYear} yet
                {' '}({notEnrolled.slice(0, 3).map(displayName).join(', ')}{notEnrolled.length > 3 ? '…' : ''}).
              </span>
              {years.some((y) => y.startYear < selectedYear.startYear) && (
                <button className="btn btn-sm rounded-3 btn-outline-secondary" onClick={() => setShowRetrieve(true)}>Retrieve from previous year</button>
              )}
              <button className="btn btn-sm rounded-3 text-white" style={{ backgroundColor: '#B26A00' }} onClick={handleEnrollCurrent} disabled={enrollingAll}>
                {enrollingAll ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-person-check me-1"></i>}
                Enroll with current grade
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="d-flex gap-2 mb-3">
            <button
              className={`btn btn-sm rounded-pill ${view === 'enrolled' ? 'text-white' : 'btn-outline-secondary'}`}
              style={view === 'enrolled' ? { backgroundColor: '#008080' } : {}}
              onClick={() => { setView('enrolled'); setFilterGrade(''); }}
            >
              <i className="bi bi-people-fill me-1"></i>
              {legacyMode ? 'Active' : `Enrolled${selectedYear ? ` · S.Y. ${selectedYear.schoolYear}` : ''}`} ({legacyMode ? students.filter((s) => s.status !== 'archived').length : (switchingYear ? '…' : enrolledRows.length)})
            </button>
            {!isPastYear && (
              <button
                className={`btn btn-sm rounded-pill ${view === 'archived' ? 'text-white' : 'btn-outline-secondary'}`}
                style={view === 'archived' ? { backgroundColor: '#d97706' } : {}}
                onClick={() => { setView('archived'); setFilterGrade(''); setFilterStatus(''); }}
              >
                <i className="bi bi-archive-fill me-1"></i>Archived accounts ({archivedStudents.length})
              </button>
            )}
          </div>

          {/* Toolbar */}
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <div className="input-group" style={{ width: 260 }}>
                <span className="input-group-text bg-white border-end-0"><i className="bi bi-search" style={{ color: '#555' }}></i></span>
                <input type="text" className="form-control border-start-0 ps-0 rounded-end-3" placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" />
              </div>
              <select className="form-select rounded-3" style={{ width: 'auto' }} value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} aria-label="Filter by grade">
                <option value="">All Grades</option>
                {grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
              {!legacyMode && view === 'enrolled' && (
                <select className="form-select rounded-3" style={{ width: 'auto' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filter by enrollment status">
                  <option value="">All Statuses</option>
                  {ENROLLMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              )}
              {(filterGrade || search || filterStatus) && (
                <button className="btn btn-sm btn-outline-secondary rounded-3" onClick={() => { setSearch(''); setFilterGrade(''); setFilterStatus(''); }}>
                  <i className="bi bi-x me-1"></i>Clear
                </button>
              )}
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <small style={{ color: '#555' }}>{filtered.length} student(s)</small>
              {view === 'enrolled' && (legacyMode || canEnroll) && (
                <>
                  {!legacyMode && (
                    <button className="btn btn-outline-secondary rounded-3 fw-medium" onClick={() => setShowRetrieve(true)}>
                      <i className="bi bi-box-arrow-in-down me-2"></i>Retrieve from Previous Year
                    </button>
                  )}
                  <button className="btn rounded-3 fw-medium" style={{ backgroundColor: '#008080', color: '#fff' }} onClick={() => setShowModal(true)}>
                    <i className="bi bi-person-plus-fill me-2"></i>Add Student
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-0">
              {loading || years === undefined || (!legacyMode && view === 'enrolled' && switchingYear) ? (
                <div className="p-3"><ListSkeleton rows={6} /></div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-4 py-3">#</th>
                        <th>Student Name</th>
                        <th>Email</th>
                        <th>{isPastYear ? `Grade (S.Y. ${selectedYear.schoolYear})` : 'Grade Level'}</th>
                        {!legacyMode && view === 'enrolled' && <th>Enrollment Status</th>}
                        {!isPastYear && <th>Lessons</th>}
                        {!isPastYear && <th>Stars</th>}
                        <th className="pe-4 text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={colCount} className="text-center py-5" style={{ color: '#555' }}>
                            <i className="bi bi-people fs-1 d-block mb-2 opacity-25"></i>
                            {view === 'archived' ? 'No archived students'
                              : legacyMode ? 'No students found'
                              : enrolledRows.length === 0 ? `No students are enrolled in S.Y. ${selectedYear?.schoolYear || ''} yet${canEnroll ? ' — add or retrieve students above.' : '.'}`
                              : 'No students match your search'}
                          </td>
                        </tr>
                      ) : (
                        filtered.map((s, i) => {
                          const st = s.enrollment ? statusInfo(s.enrollment.status) : null;
                          const accountUsable = !s.accountArchived && !s.missingAccount;
                          return (
                          <tr key={s.id}>
                            <td className="ps-4 small" style={{ color: '#555' }}>{i + 1}</td>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 36, height: 36, backgroundColor: '#00838A18', flexShrink: 0 }}>
                                  <i className="bi bi-person-fill" style={{ color: '#00838A' }}></i>
                                </div>
                                <div>
                                  <span className="fw-medium">{displayName(s)}</span>
                                  {view === 'archived' && s.archive_reason && (
                                    <div className="small" style={{ color: '#9a5b05', maxWidth: 320, whiteSpace: 'pre-line' }} title="Reason for archiving">
                                      <i className="bi bi-archive me-1"></i>{s.archive_reason}
                                    </div>
                                  )}
                                  {view === 'enrolled' && s.accountArchived && (
                                    <div className="small" style={{ color: '#9a5b05' }}><i className="bi bi-archive me-1"></i>Account archived</div>
                                  )}
                                  {s.enrollment?.retrieved_from && (
                                    <div className="small" style={{ color: '#888' }}><i className="bi bi-box-arrow-in-down me-1"></i>From S.Y. {s.enrollment.retrieved_from}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="small" style={{ color: '#444' }}>{s.email}</td>
                            <td>
                              <span className="badge rounded-pill" style={{ backgroundColor: '#00838A18', color: '#00838A', fontWeight: 500, fontSize: 12 }}>
                                Grade {s.grade_level}
                              </span>
                            </td>
                            {!legacyMode && view === 'enrolled' && (
                              <td>
                                <div className="d-flex align-items-center gap-1">
                                  <select
                                    className="form-select form-select-sm rounded-pill fw-medium"
                                    style={{ width: 'auto', color: st.color, backgroundColor: st.bg, borderColor: 'transparent', fontSize: 12 }}
                                    value={s.enrollment.status}
                                    onChange={(e) => handleStatusChange(s, e.target.value)}
                                    disabled={statusSavingId === s.enrollment.id}
                                    aria-label={`Enrollment status of ${displayName(s)}`}
                                  >
                                    {ENROLLMENT_STATUSES
                                      .filter((x) => x.value === s.enrollment.status
                                        || (Number(s.grade_level) >= 6 ? x.value !== 'promoted' : x.value !== GRADUATED))
                                      .map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                                  </select>
                                  {statusSavingId === s.enrollment.id && <span className="spinner-border spinner-border-sm" style={{ color: '#008080' }}></span>}
                                </div>
                              </td>
                            )}
                            {!isPastYear && <td><span className="badge bg-success bg-opacity-10 text-success rounded-pill px-3">{lessonsCompletedMap[s.id] || 0}</span></td>}
                            {!isPastYear && <td><span className="fw-semibold" style={{ color: '#F57F17' }}>{pointsMap[s.id] || 0} ⭐</span></td>}
                            <td className="pe-4">
                              <div className="d-flex justify-content-end gap-1 flex-wrap">

                                {/* View details & progress (parent's name and contact live there) */}
                                {!s.missingAccount && (
                                  <button
                                    className="btn btn-sm rounded-3"
                                    style={{ backgroundColor: '#00838A18', color: '#00838A' }}
                                    onClick={() => navigate(`/teacher/students/${s.id}/progress`)}
                                    title="View details & progress"
                                  >
                                    <i className="bi bi-eye-fill"></i>
                                  </button>
                                )}

                                {view === 'enrolled' && !isPastYear && accountUsable && (
                                  <>
                                    {/* Edit */}
                                    <button
                                      className="btn btn-sm btn-outline-secondary rounded-3"
                                      onClick={() => setEditTarget(usersById[s.id])}
                                      title="Edit student information"
                                      aria-label={`Edit ${displayName(s)}`}
                                    >
                                      <i className="bi bi-pencil-fill"></i>
                                    </button>

                                    {/* Send Credentials */}
                                    <button
                                      className="btn btn-sm rounded-3 fw-medium d-flex align-items-center gap-1"
                                      style={{ backgroundColor: '#008080', color: '#fff', fontSize: 12 }}
                                      onClick={() => handleSendCredentials(s)}
                                      disabled={sendLoadingId === s.id}
                                      title={`Send login email & password to ${s.email}`}
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
                                      onClick={() => setArchiveTarget(usersById[s.id])}
                                      title="Archive student account"
                                    >
                                      <i className="bi bi-archive-fill"></i>
                                    </button>
                                  </>
                                )}
                                {view === 'archived' && (
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
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && <AddStudentModal schoolYear={legacyMode ? null : selectedYear} onClose={() => setShowModal(false)} onSuccess={handleCreated} />}

      {createdStudent && (
        <AccountCreatedModal
          student={createdStudent}
          onClose={() => setCreatedStudent(null)}
          onSendNow={handleSendFromModal}
        />
      )}

      {editTarget && (
        <EditStudentModal
          student={editTarget}
          activeYear={activeYear}
          onClose={() => setEditTarget(null)}
          onSaved={(msg) => { setEditTarget(null); setToast({ type: 'success', message: 'Student updated', sub: msg }); refreshAll(); }}
        />
      )}

      {showRetrieve && selectedYear && (
        <RetrieveModal
          years={years}
          targetYear={selectedYear}
          usersById={usersById}
          alreadyEnrolled={enrolledIds}
          onClose={() => setShowRetrieve(false)}
          onDone={(data) => {
            setShowRetrieve(false);
            const skipped = data.skipped?.length ? ` ${data.skipped.length} skipped (${data.skipped.map((x) => x.name || x.uid).slice(0, 3).join(', ')}).` : '';
            const grads = data.graduated?.length ? ` ${data.graduated.length} graduated 🎓.` : '';
            const sent = data.emails?.sent ? ` ${data.emails.sent} congratulation email${data.emails.sent === 1 ? '' : 's'} sent.` : '';
            const failed = data.emails?.failed?.length ? ` ${data.emails.failed.length} email${data.emails.failed.length === 1 ? '' : 's'} could not be sent (${data.emails.failed.map((x) => x.name).slice(0, 3).join(', ')}).` : '';
            setToast({
              type: failed ? 'error' : 'success',
              message: data.graduated?.length && !data.enrolled.length ? 'Students graduated' : 'Students retrieved',
              sub: `${data.enrolled.length} student${data.enrolled.length === 1 ? '' : 's'} enrolled in S.Y. ${data.schoolYear}.${grads}${skipped}${sent}${failed}`,
            });
            refreshAll();
          }}
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
