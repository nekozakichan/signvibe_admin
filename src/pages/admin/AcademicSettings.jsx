import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import { CardSkeleton } from '../../components/Skeletons';
import { useAuth } from '../../context/AuthContext';
import {
  SEMESTERS,
  guessStartYear,
  parseSchoolYear,
  saveAcademicTerm,
  schoolYearFor,
  semesterLabel,
  watchAcademicTerm,
} from '../../config/academicTerm';
import {
  activateSchoolYear,
  addSchoolYear,
  checkDateRange,
  checkInsideYear,
  formatRange,
  markActiveFromTerm,
  saveSemesters,
  seedFromTerm,
  updateSchoolYear,
  watchSchoolYears,
} from '../../config/schoolYears';

const TEAL = '#00838A';

// ─── Modal shell ──────────────────────────────────────────────────────────────
// Rendered into <body>: the page animates in with a transform, which would
// otherwise trap a fixed-position overlay inside the page area.
function Modal({ title, icon, onClose, busy, children, footer }) {
  return createPortal(
    <>
      <div onClick={busy ? undefined : onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'calc(100% - 32px)', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fff', borderRadius: 16, padding: 28, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
      >
        <div className="d-flex justify-content-between align-items-start mb-3">
          <h5 className="fw-bold mb-0" style={{ color: TEAL }}><i className={`bi ${icon} me-2`}></i>{title}</h5>
          {!busy && <button className="btn-close" onClick={onClose} aria-label="Close"></button>}
        </div>
        {children}
        <div className="d-flex gap-2 mt-4">{footer}</div>
      </div>
    </>,
    document.body
  );
}

function DateField({ id, label, value, onChange, disabled, min, max }) {
  return (
    <div className="col-6">
      <label className="form-label small fw-medium" htmlFor={id}>
        {label} <span style={{ color: '#777', fontSize: 11 }}>(optional)</span>
      </label>
      <input id={id} type="date" className="form-control rounded-3" value={value || ''} min={min} max={max}
        onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

// ─── Add / Edit School Year ───────────────────────────────────────────────────
function SchoolYearModal({ initial, existing, onClose, onSave }) {
  const [yearText, setYearText] = useState(initial ? initial.schoolYear : schoolYearFor(
    Math.max(guessStartYear(), ...existing.map((y) => y.startYear + 1))
  ));
  const [startDate, setStartDate] = useState(initial?.startDate || '');
  const [endDate, setEndDate] = useState(initial?.endDate || '');
  const [withFirstSem, setWithFirstSem] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const parsed = parseSchoolYear(yearText);
  const duplicate = !parsed.error && existing.some((y) => y.startYear === parsed.startYear && y.id !== initial?.id);
  const semOutside = initial && !parsed.error && initial.semesters.find((s) =>
    checkInsideYear({ startDate, endDate }, s.startDate, s.endDate));

  const problem = parsed.error
    || (duplicate && `S.Y. ${schoolYearFor(parsed.startYear)} already exists.`)
    || checkDateRange(startDate, endDate)
    || (semOutside && `${semOutside.label}'s dates fall outside these dates. Change the semester first.`)
    || '';

  const handleSave = async () => {
    if (problem) { setError(problem); return; }
    setSaving(true); setError('');
    try {
      await onSave({ startYear: parsed.startYear, startDate, endDate, withFirstSem });
    } catch (err) {
      setError('Could not save: ' + err.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial ? `Edit S.Y. ${initial.schoolYear}` : 'Add School Year'}
      icon={initial ? 'bi-pencil-square' : 'bi-calendar-plus'}
      onClose={onClose}
      busy={saving}
      footer={<>
        <button className="btn flex-fill rounded-3 fw-medium text-white" style={{ backgroundColor: TEAL }} onClick={handleSave} disabled={saving}>
          {saving ? <span className="spinner-border spinner-border-sm"></span> : (initial ? 'Save Changes' : 'Add School Year')}
        </button>
        <button className="btn btn-outline-secondary rounded-3" onClick={onClose} disabled={saving}>Cancel</button>
      </>}
    >
      {error && <div className="alert alert-danger py-2 small rounded-3"><i className="bi bi-exclamation-circle me-1"></i>{error}</div>}
      <div className="mb-3">
        <label className="form-label small fw-medium" htmlFor="sv-sy-year">School Year</label>
        <div className="input-group">
          <span className="input-group-text bg-white rounded-start-3" style={{ color: TEAL }}>S.Y.</span>
          <input
            id="sv-sy-year" type="text" inputMode="numeric" maxLength={11}
            className={`form-control rounded-end-3 ${yearText && (parsed.error || duplicate) ? 'is-invalid' : ''}`}
            placeholder="e.g. 2026-2027" value={yearText}
            onChange={(e) => { setYearText(e.target.value); setError(''); }}
            onBlur={() => { if (!parsed.error) setYearText(schoolYearFor(parsed.startYear)); }}
            disabled={saving} autoFocus
          />
        </div>
        <div className="mt-1" style={{ fontSize: 11, color: yearText && (parsed.error || duplicate) ? '#c62828' : '#666' }}>
          {yearText && parsed.error ? parsed.error
            : duplicate ? `S.Y. ${schoolYearFor(parsed.startYear)} already exists.`
            : 'Type the start and end year, e.g. 2026-2027. Typing just 2026 also works.'}
        </div>
      </div>
      <div className="row g-2">
        <DateField id="sv-sy-start" label="Start date" value={startDate} onChange={(v) => { setStartDate(v); setError(''); }} disabled={saving} max={endDate || undefined} />
        <DateField id="sv-sy-end" label="End date" value={endDate} onChange={(v) => { setEndDate(v); setError(''); }} disabled={saving} min={startDate || undefined} />
      </div>
      {!initial && (
        <div className="form-check mt-3">
          <input className="form-check-input" type="checkbox" id="sv-sy-firstsem" checked={withFirstSem}
            onChange={(e) => setWithFirstSem(e.target.checked)} disabled={saving} />
          <label className="form-check-label small" htmlFor="sv-sy-firstsem">Add 1st Semester now</label>
        </div>
      )}
    </Modal>
  );
}

// ─── Add / Edit Semester ──────────────────────────────────────────────────────
function SemesterModal({ year, initial, onClose, onSave }) {
  const used = new Set(year.semesters.map((s) => s.semester));
  const available = SEMESTERS.filter((s) => !used.has(s.value) || s.value === initial?.semester);
  const [semester, setSemester] = useState(initial?.semester ?? available[0]?.value);
  const [startDate, setStartDate] = useState(initial?.startDate || '');
  const [endDate, setEndDate] = useState(initial?.endDate || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Semesters shouldn't overlap each other.
  const overlap = year.semesters.find((s) => s.semester !== semester && s.startDate && s.endDate && startDate && endDate
    && startDate <= s.endDate && endDate >= s.startDate);

  const problem = (!semester && 'Choose a semester.')
    || checkDateRange(startDate, endDate)
    || checkInsideYear(year, startDate, endDate)
    || (overlap && `These dates overlap ${overlap.label}.`)
    || '';

  const handleSave = async () => {
    if (problem) { setError(problem); return; }
    setSaving(true); setError('');
    try {
      await onSave({ semester, startDate, endDate });
    } catch (err) {
      setError('Could not save: ' + err.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial ? `Edit ${initial.label}` : `Add Semester to S.Y. ${year.schoolYear}`}
      icon={initial ? 'bi-pencil-square' : 'bi-plus-circle'}
      onClose={onClose}
      busy={saving}
      footer={<>
        <button className="btn flex-fill rounded-3 fw-medium text-white" style={{ backgroundColor: TEAL }} onClick={handleSave} disabled={saving}>
          {saving ? <span className="spinner-border spinner-border-sm"></span> : (initial ? 'Save Changes' : 'Add Semester')}
        </button>
        <button className="btn btn-outline-secondary rounded-3" onClick={onClose} disabled={saving}>Cancel</button>
      </>}
    >
      {error && <div className="alert alert-danger py-2 small rounded-3"><i className="bi bi-exclamation-circle me-1"></i>{error}</div>}
      <div className="mb-3">
        <label className="form-label small fw-medium d-block">Semester</label>
        {initial ? (
          <div className="fw-semibold" style={{ color: TEAL }}>{initial.label}</div>
        ) : (
          <div className="d-flex gap-2 flex-wrap" role="radiogroup" aria-label="Semester">
            {SEMESTERS.map((s) => {
              const taken = used.has(s.value);
              const active = semester === s.value;
              return (
                <button key={s.value} type="button" role="radio" aria-checked={active} disabled={taken || saving}
                  className="btn rounded-3 fw-medium flex-fill"
                  style={active ? { backgroundColor: TEAL, color: '#fff', border: `1px solid ${TEAL}` }
                    : { backgroundColor: '#fff', color: taken ? '#aaa' : TEAL, border: '1px solid #b2dfdb' }}
                  onClick={() => { setSemester(s.value); setError(''); }}
                  title={taken ? 'Already added' : undefined}
                >
                  {active && <i className="bi bi-check-circle-fill me-1"></i>}{s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="row g-2">
        <DateField id="sv-sem-start" label="Start date" value={startDate} onChange={(v) => { setStartDate(v); setError(''); }} disabled={saving}
          min={year.startDate || undefined} max={endDate || year.endDate || undefined} />
        <DateField id="sv-sem-end" label="End date" value={endDate} onChange={(v) => { setEndDate(v); setError(''); }} disabled={saving}
          min={startDate || year.startDate || undefined} max={year.endDate || undefined} />
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AcademicSettings() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const [term, setTerm] = useState(undefined);        // active term (settings/academic_term)
  const [years, setYears] = useState(undefined);      // school_years list
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [yearModal, setYearModal] = useState(null);   // { initial? }
  const [semModal, setSemModal] = useState(null);     // { year, initial? }
  const [busyKey, setBusyKey] = useState(null);       // which "Set Active"/remove is running
  const seeded = useRef(false);

  useEffect(() => watchAcademicTerm(setTerm), []);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => watchSchoolYears(
    (list) => { setYears(list); setLoadFailed(false); },
    (err) => {
      // Show the page anyway (with an explanation) instead of loading forever.
      setLoadFailed(true);
      setYears([]);
      setError(err.code === 'permission-denied'
        ? 'Firestore refused to load the school year list. Deploy the updated security rules (firebase deploy --only firestore:rules), then refresh.'
        : 'Could not load school years: ' + err.message);
    }
  ), []);

  // First visit: copy the existing current term (and past terms) into the list.
  useEffect(() => {
    if (seeded.current || loadFailed || years === undefined || term === undefined) return;
    if (years.length === 0 && term) {
      seeded.current = true;
      seedFromTerm(term, uid).catch((err) => setError('Could not set up the school year list: ' + err.message));
    }
  }, [years, term, uid, loadFailed]);

  // Lists made before the active flag existed: flag the year matching the current term.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || loadFailed || !years?.length || !term || years.some((y) => y.isActive)) return;
    marked.current = true;
    markActiveFromTerm(years, term).catch((err) => setError('Could not mark the active school year: ' + err.message));
  }, [years, term, loadFailed]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loading = years === undefined || term === undefined;
  const activeYear = years?.find((y) => y.isActive) || null;
  const isActiveYear = (y) => y.isActive;
  const activeSemesterOf = (y) => y.activeSemester ?? (term && term.startYear === y.startYear ? term.semester : null);
  const isActiveSem = (y, s) => y.isActive && activeSemesterOf(y) === s.semester;

  const run = async (key, fn, okText) => {
    setBusyKey(key); setError('');
    try {
      const result = await fn();
      const text = typeof okText === 'function' ? okText(result) : okText;
      if (text) setToast(text);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey(null);
    }
  };

  // Activate a school year (with its first semester), or switch the semester
  // inside the active year. Activating a year deactivates the previous one.
  const handleActivate = (y, semester) => {
    const switchingYear = !y.isActive;
    if (switchingYear && activeYear && !window.confirm(
      `Activate S.Y. ${y.schoolYear}?\n\nS.Y. ${activeYear.schoolYear} will be deactivated. `
      + 'Only one school year can be active at a time.\n\n'
      + `Each student's grade will switch to their grade in S.Y. ${y.schoolYear}. `
      + 'Students not enrolled in that year keep their current grade. No records are deleted.'
    )) return;
    run(
      `${y.id}:${semester}`,
      () => activateSchoolYear(years, y, semester, uid),
      switchingYear
        ? (changed) => `S.Y. ${y.schoolYear} is now active${activeYear ? ` — S.Y. ${activeYear.schoolYear} was deactivated` : ''}.`
          + (changed ? ` ${changed} student grade${changed === 1 ? '' : 's'} updated to match S.Y. ${y.schoolYear}.` : '')
        : `${semesterLabel(semester)} is now the active semester of S.Y. ${y.schoolYear}.`
    );
  };

  const handleSaveYear = async ({ startYear, startDate, endDate, withFirstSem }) => {
    const initial = yearModal.initial;
    if (initial) {
      await updateSchoolYear(initial.id, { startYear, startDate, endDate, uid });
      // Renamed the active school year (e.g. fixing a typo): keep the current term in step.
      if (isActiveYear(initial) && startYear !== initial.startYear) {
        await saveAcademicTerm({ startYear, semester: term.semester, uid });
      }
      setToast(`S.Y. ${schoolYearFor(startYear)} updated.`);
    } else {
      await addSchoolYear({ startYear, startDate, endDate, semesters: withFirstSem ? [{ semester: 1 }] : [], uid });
      setToast(`S.Y. ${schoolYearFor(startYear)} added.`);
    }
    setYearModal(null);
  };

  const handleSaveSemester = async ({ semester, startDate, endDate }) => {
    const { year, initial } = semModal;
    const others = year.semesters.filter((s) => s.semester !== (initial?.semester ?? semester));
    await saveSemesters(year.id, [...others, { semester, startDate, endDate }], uid);
    setToast(`${semesterLabel(semester)} ${initial ? 'updated' : 'added'} for S.Y. ${year.schoolYear}.`);
    setSemModal(null);
  };

  const handleRemoveSemester = (y, s) => {
    if (!window.confirm(`Remove ${s.label} from S.Y. ${y.schoolYear}? Students' records are not affected.`)) return;
    run(`rm:${y.id}:${s.semester}`,
      () => saveSemesters(y.id, y.semesters.filter((x) => x.semester !== s.semester), uid),
      `${s.label} removed from S.Y. ${y.schoolYear}.`);
  };

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="sv-shell">
        <Navbar title="School Year Management" />

        <div className="p-4 sv-page">
          {error && (
            <div className="alert alert-danger py-2 small rounded-3 d-flex align-items-center">
              <i className="bi bi-exclamation-circle me-2"></i><span className="flex-fill">{error}</span>
              <button className="btn-close btn-sm" onClick={() => setError('')} aria-label="Dismiss"></button>
            </div>
          )}

          {loading ? (
            <CardSkeleton height={200} />
          ) : (
            <>
              {/* Active term + Add */}
              <div className="card border-0 shadow-sm rounded-4 mb-4 sv-fade-up" style={{ borderLeft: `4px solid ${TEAL}` }}>
                <div className="card-body p-4 d-flex flex-wrap align-items-center gap-3">
                  <div className="flex-fill" style={{ minWidth: 240 }}>
                    <p className="small fw-semibold mb-1" style={{ color: TEAL }}>
                      <i className="bi bi-calendar-check-fill me-2"></i>Active School Year
                    </p>
                    {activeYear ? (
                      <>
                        <h3 className="fw-bold mb-0" style={{ color: TEAL }}>S.Y. {activeYear.schoolYear}</h3>
                        <p className="mb-0" style={{ color: '#333' }}>{semesterLabel(activeSemesterOf(activeYear)) || 'No semester selected'}</p>
                      </>
                    ) : term && loadFailed ? (
                      <>
                        <h3 className="fw-bold mb-0" style={{ color: TEAL }}>S.Y. {term.schoolYear}</h3>
                        <p className="mb-0" style={{ color: '#333' }}>{term.semesterLabel}</p>
                      </>
                    ) : (
                      <p className="mb-0 small" style={{ color: '#78550a' }}>
                        <i className="bi bi-exclamation-triangle-fill me-1"></i>
                        No active school year. Add one below and press <strong>Activate</strong>.
                      </p>
                    )}
                  </div>
                  <button className="btn rounded-3 fw-medium text-white" style={{ backgroundColor: TEAL }} onClick={() => setYearModal({})} disabled={loadFailed}>
                    <i className="bi bi-plus-circle me-2"></i>Add School Year
                  </button>
                </div>
              </div>

              {/* List */}
              <h6 className="fw-semibold mb-3" style={{ color: '#333' }}>
                School Years <span className="text-muted fw-normal small">({years.length})</span>
              </h6>

              {years.length === 0 && !loadFailed && (
                <div className="text-center py-5" style={{ color: '#666' }}>
                  <i className="bi bi-calendar3 fs-1 d-block mb-2 opacity-25"></i>
                  No school years yet. Click <strong>Add School Year</strong> to create the first one.
                </div>
              )}

              {years.map((y, i) => {
                const isActive = isActiveYear(y);
                const firstSem = y.semesters[0]?.semester;
                return (
                  <div key={y.id} className="card border-0 shadow-sm rounded-4 mb-3 sv-fade-up"
                    style={{ animationDelay: `${Math.min(i, 6) * 50}ms`, outline: isActive ? `2px solid ${TEAL}` : 'none' }}>
                    <div className="card-body p-4">
                      {/* Year header */}
                      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                        <div className="flex-fill" style={{ minWidth: 200 }}>
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <h5 className="fw-bold mb-0" style={{ color: isActive ? TEAL : '#333' }}>S.Y. {y.schoolYear}</h5>
                            {isActive ? (
                              <span className="badge rounded-pill" style={{ backgroundColor: TEAL }}>
                                <i className="bi bi-check-circle-fill me-1"></i>Active
                              </span>
                            ) : (
                              <span className="badge rounded-pill" style={{ backgroundColor: '#eee', color: '#666', fontWeight: 500 }}>Inactive</span>
                            )}
                          </div>
                          <div className="small" style={{ color: '#666' }}>
                            <i className="bi bi-calendar-range me-1"></i>{formatRange(y.startDate, y.endDate)}
                          </div>
                        </div>
                        <div className="d-flex gap-2 flex-wrap">
                          {!isActive && (
                            <button className="btn btn-sm rounded-3 fw-medium text-white" style={{ backgroundColor: TEAL }}
                              onClick={() => handleActivate(y, firstSem)} disabled={!firstSem || !!busyKey || loadFailed}
                              title={firstSem ? `Activate S.Y. ${y.schoolYear} (starts on ${semesterLabel(firstSem)})` : 'Add a semester first'}
                              aria-label={`Activate S.Y. ${y.schoolYear}`}>
                              {busyKey === `${y.id}:${firstSem}` ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-power me-1"></i>}
                              Activate
                            </button>
                          )}
                          <button className="btn btn-sm btn-outline-secondary rounded-3" onClick={() => setYearModal({ initial: y })} disabled={!!busyKey}>
                            <i className="bi bi-pencil-fill me-1"></i>Edit
                          </button>
                          <button className="btn btn-sm rounded-3" style={{ backgroundColor: '#00838A18', color: TEAL }}
                            onClick={() => setSemModal({ year: y })} disabled={y.semesters.length >= SEMESTERS.length || !!busyKey}
                            title={y.semesters.length >= SEMESTERS.length ? 'All three semesters added' : undefined}>
                            <i className="bi bi-plus-circle me-1"></i>Add Semester
                          </button>
                        </div>
                      </div>

                      {/* Semesters */}
                      {y.semesters.length === 0 ? (
                        <div className="small p-3 rounded-3" style={{ backgroundColor: '#fff8e1', color: '#78550a' }}>
                          <i className="bi bi-info-circle me-1"></i>No semesters yet. Add one to be able to set this school year active.
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-sm align-middle mb-0">
                            <thead className="table-light">
                              <tr>
                                <th className="ps-3">Semester</th>
                                <th>Dates</th>
                                <th>Status</th>
                                <th className="text-end pe-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {y.semesters.map((s) => {
                                const activeSem = isActiveSem(y, s);
                                const key = `${y.id}:${s.semester}`;
                                return (
                                  <tr key={s.semester} style={activeSem ? { backgroundColor: '#e6f4f4' } : undefined}>
                                    <td className="ps-3 fw-medium">{s.label}</td>
                                    <td className="small" style={{ color: '#555' }}>{formatRange(s.startDate, s.endDate)}</td>
                                    <td>
                                      {activeSem ? (
                                        <span className="badge rounded-pill" style={{ backgroundColor: TEAL }}>
                                          <i className="bi bi-check-circle-fill me-1"></i>Active
                                        </span>
                                      ) : isActive ? (
                                        <button className="btn btn-sm btn-outline-secondary rounded-pill" style={{ fontSize: 12 }}
                                          onClick={() => handleActivate(y, s.semester)} disabled={!!busyKey}
                                          aria-label={`Make ${s.label} the active semester`}>
                                          {busyKey === key ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-power me-1"></i>}
                                          Set Active
                                        </button>
                                      ) : (
                                        <span className="small" style={{ color: '#999' }}>Inactive</span>
                                      )}
                                    </td>
                                    <td className="text-end pe-3 text-nowrap">
                                      <button className="btn btn-sm btn-outline-secondary rounded-3 me-1" onClick={() => setSemModal({ year: y, initial: s })}
                                        disabled={!!busyKey} title={`Edit ${s.label}`} aria-label={`Edit ${s.label} of S.Y. ${y.schoolYear}`}>
                                        <i className="bi bi-pencil-fill"></i>
                                      </button>
                                      <button className="btn btn-sm btn-outline-danger rounded-3" onClick={() => handleRemoveSemester(y, s)}
                                        disabled={activeSem || !!busyKey}
                                        title={activeSem ? 'This is the active semester — set another one active first' : `Remove ${s.label}`}
                                        aria-label={`Remove ${s.label} of S.Y. ${y.schoolYear}`}>
                                        <i className="bi bi-trash3"></i>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            </>
          )}

          {yearModal && (
            <SchoolYearModal initial={yearModal.initial} existing={years || []} onClose={() => setYearModal(null)} onSave={handleSaveYear} />
          )}
          {semModal && (
            <SemesterModal year={semModal.year} initial={semModal.initial} onClose={() => setSemModal(null)} onSave={handleSaveSemester} />
          )}

          {toast && createPortal(
            <div role="status" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, maxWidth: 420, backgroundColor: '#e6f9f9', border: `1px solid ${TEAL}`, borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
              <i className="bi bi-check-circle-fill me-2" style={{ color: TEAL }}></i>
              <span className="small fw-medium" style={{ color: '#005f5f' }}>{toast}</span>
            </div>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
}
