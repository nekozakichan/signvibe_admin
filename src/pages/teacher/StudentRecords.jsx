import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../api/firebase';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import { ListSkeleton } from '../../components/Skeletons';
import { buildFullName } from '../../utils/name';
import { watchSchoolYears } from '../../config/schoolYears';
import { ENROLLMENT_STATUSES, loadAllEnrollments, statusInfo } from '../../config/enrollments';

// ─── Student Records ──────────────────────────────────────────────────────────
// Historical records: every student account, past and present, with their
// enrollment in each school year. Search by name or email, narrow by school
// year / grade / status, and open a student to see their full history.

const TEAL = '#008080';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function StatusBadge({ status }) {
  const st = statusInfo(status);
  return <span className="badge rounded-pill fw-medium" style={{ color: st.color, backgroundColor: st.bg, fontSize: 12 }}>{st.label}</span>;
}

export default function StudentRecords() {
  const navigate = useNavigate();
  const [students, setStudents] = useState(null);
  const [enrollments, setEnrollments] = useState(null);
  const [years, setYears] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [open, setOpen] = useState(() => new Set());

  useEffect(() => watchSchoolYears(setYears, () => setYears([])), []);
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
        setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setEnrollments(await loadAllEnrollments());
      } catch (err) {
        setStudents((s) => s || []);
        setEnrollments([]);
        setError(err.code === 'permission-denied'
          ? 'Firestore refused to load enrollment records. Deploy the updated security rules (firebase deploy --only firestore:rules), then refresh.'
          : 'Could not load records: ' + err.message);
      }
    })();
  }, []);

  const activeYear = years.find((y) => y.isActive) || null;

  // One entry per student: account + their enrollments, newest year first.
  const records = useMemo(() => {
    if (!students || !enrollments) return [];
    const byStudent = {};
    enrollments.forEach((e) => { (byStudent[e.student_id] ||= []).push(e); });
    const list = students.map((s) => ({
      id: s.id,
      name: s.full_name || buildFullName(s),
      email: s.email || '',
      accountStatus: s.status === 'archived' ? 'archived' : 'active',
      archiveReason: s.archive_reason || '',
      history: (byStudent[s.id] || []).sort((a, b) => b.start_year - a.start_year),
    }));
    // Enrollments whose account was removed still count as records.
    Object.entries(byStudent).forEach(([uid, hist]) => {
      if (!students.some((s) => s.id === uid)) {
        list.push({ id: uid, name: hist[0].student_name, email: hist[0].student_email, accountStatus: 'missing', history: hist.sort((a, b) => b.start_year - a.start_year) });
      }
    });
    return list;
  }, [students, enrollments]);

  const q = search.trim().toLowerCase();
  const results = records
    .map((r) => {
      // The record that matches the year/grade/status filters (or the latest).
      const matching = r.history.filter((e) =>
        (!yearFilter || e.school_year_id === yearFilter)
        && (!gradeFilter || String(e.grade_level) === gradeFilter)
        && (!statusFilter || e.status === statusFilter));
      return { ...r, shown: matching[0] || null, matching };
    })
    .filter((r) => {
      const textOk = !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
      const filtersOn = yearFilter || gradeFilter || statusFilter;
      return textOk && (!filtersOn || r.matching.length > 0);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const loading = students === null || enrollments === null;
  const toggle = (id) => setOpen((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clear = () => { setSearch(''); setYearFilter(''); setGradeFilter(''); setStatusFilter(''); };

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="sv-shell">
        <Navbar title="Student Records" />
        <div className="p-4 sv-page">
          <p className="mb-3" style={{ color: '#555' }}>
            Search every student — current and from previous school years — and check their enrollment history.
          </p>

          {error && <div className="alert alert-danger py-2 small rounded-3"><i className="bi bi-exclamation-circle me-1"></i>{error}</div>}

          {/* Filters */}
          <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
            <div className="input-group" style={{ width: 280 }}>
              <span className="input-group-text bg-white border-end-0"><i className="bi bi-search" style={{ color: '#555' }}></i></span>
              <input className="form-control border-start-0 ps-0 rounded-end-3" placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" />
            </div>
            <select className="form-select rounded-3" style={{ width: 'auto' }} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} aria-label="School year">
              <option value="">All School Years</option>
              {years.map((y) => <option key={y.id} value={y.id}>S.Y. {y.schoolYear}{y.isActive ? ' (Active)' : ''}</option>)}
            </select>
            <select className="form-select rounded-3" style={{ width: 'auto' }} value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} aria-label="Grade">
              <option value="">All Grades</option>
              {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
            <select className="form-select rounded-3" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Enrollment status">
              <option value="">All Statuses</option>
              {ENROLLMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {(search || yearFilter || gradeFilter || statusFilter) && (
              <button className="btn btn-sm btn-outline-secondary rounded-3" onClick={clear}><i className="bi bi-x me-1"></i>Clear</button>
            )}
            <small className="ms-auto" style={{ color: '#555' }}>{results.length} student(s)</small>
          </div>

          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-0">
              {loading ? (
                <div className="p-3"><ListSkeleton rows={6} /></div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-4 py-3" style={{ width: 40 }}></th>
                        <th>Student</th>
                        <th>{yearFilter ? 'School Year' : 'Latest School Year'}</th>
                        <th>Grade</th>
                        <th>Enrollment Status</th>
                        <th>Years Enrolled</th>
                        <th>Account</th>
                        <th className="pe-4 text-end">Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.length === 0 ? (
                        <tr><td colSpan="8" className="text-center py-5" style={{ color: '#555' }}>
                          <i className="bi bi-search fs-1 d-block mb-2 opacity-25"></i>No students match your search.
                        </td></tr>
                      ) : results.map((r) => {
                        const isOpen = open.has(r.id);
                        const shown = r.shown || r.history[0] || null;
                        return (
                          <Fragment key={r.id}>
                            <tr style={{ cursor: r.history.length ? 'pointer' : 'default' }} onClick={() => r.history.length && toggle(r.id)}>
                              <td className="ps-4">
                                {r.history.length > 0 && (
                                  <button className="btn btn-sm p-0 border-0" aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} enrollment history of ${r.name}`}
                                    onClick={(e) => { e.stopPropagation(); toggle(r.id); }}>
                                    <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`} style={{ color: TEAL }}></i>
                                  </button>
                                )}
                              </td>
                              <td>
                                <div className="fw-medium">{r.name}</div>
                                <div className="small" style={{ color: '#666' }}>{r.email}</div>
                              </td>
                              <td className="small text-nowrap">
                                {shown ? <>S.Y. {shown.school_year}{activeYear && shown.school_year_id === activeYear.id && <span className="ms-1" style={{ color: TEAL }}>(Active)</span>}</> : <span style={{ color: '#999' }}>No enrollment records</span>}
                              </td>
                              <td>{shown ? <span className="badge rounded-pill" style={{ backgroundColor: '#00838A18', color: TEAL, fontWeight: 500 }}>Grade {shown.grade_level}</span> : '—'}</td>
                              <td>{shown ? <StatusBadge status={shown.status} /> : '—'}</td>
                              <td className="small">{r.history.length}</td>
                              <td className="small">
                                {r.accountStatus === 'archived'
                                  ? <span title={r.archiveReason} style={{ color: '#B26A00' }}><i className="bi bi-archive me-1"></i>Archived</span>
                                  : r.accountStatus === 'missing'
                                    ? <span style={{ color: '#999' }}>Removed</span>
                                    : <span style={{ color: TEAL }}><i className="bi bi-check-circle me-1"></i>Active</span>}
                              </td>
                              <td className="pe-4 text-end">
                                {r.accountStatus !== 'missing' && (
                                  <button className="btn btn-sm rounded-3" style={{ backgroundColor: '#00838A18', color: TEAL }} title="View progress"
                                    onClick={(e) => { e.stopPropagation(); navigate(`/teacher/students/${r.id}/progress`); }}>
                                    <i className="bi bi-eye-fill"></i>
                                  </button>
                                )}
                              </td>
                            </tr>
                            {isOpen && (
                              <tr>
                                <td></td>
                                <td colSpan="7" className="pb-3" style={{ backgroundColor: '#f8fbfb' }}>
                                  <div className="small fw-semibold mb-2 mt-1" style={{ color: TEAL }}><i className="bi bi-clock-history me-1"></i>Enrollment history</div>
                                  <table className="table table-sm mb-0 bg-white rounded-3 overflow-hidden">
                                    <thead className="table-light">
                                      <tr><th>School Year</th><th>Grade</th><th>Status</th><th>Retrieved From</th><th>Enrolled On</th><th>Status Changed</th></tr>
                                    </thead>
                                    <tbody>
                                      {r.history.map((e) => (
                                        <tr key={e.id}>
                                          <td>S.Y. {e.school_year}</td>
                                          <td>Grade {e.grade_level}</td>
                                          <td><StatusBadge status={e.status} /></td>
                                          <td>{e.retrieved_from ? `S.Y. ${e.retrieved_from}` : '—'}</td>
                                          <td>{formatDate(e.enrolled_at)}</td>
                                          <td>{formatDate(e.status_changed_at)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
