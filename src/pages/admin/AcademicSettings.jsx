import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import { CardSkeleton } from '../../components/Skeletons';
import { useAuth } from '../../context/AuthContext';
import {
  SEMESTERS,
  guessStartYear,
  loadAcademicTerm,
  parseSchoolYear,
  saveAcademicTerm,
  schoolYearFor,
} from '../../config/academicTerm';
import NewSchoolYearWizard from './NewSchoolYearWizard';

export default function AcademicSettings() {
  const { currentUser } = useAuth();
  const [current, setCurrent] = useState(null);
  const [yearText, setYearText] = useState(schoolYearFor(guessStartYear()));
  const [semester, setSemester] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }
  const [showWizard, setShowWizard] = useState(false);

  const refresh = () =>
    loadAcademicTerm().then((term) => {
      setCurrent(term);
      if (term) { setYearText(term.schoolYear); setSemester(term.semester); }
    });

  useEffect(() => {
    loadAcademicTerm()
      .then((term) => {
        setCurrent(term);
        if (term) {
          setYearText(term.schoolYear);
          setSemester(term.semester);
        }
      })
      .catch((err) => setMessage({ type: 'error', text: 'Could not load the current term: ' + err.message }))
      .finally(() => setLoading(false));
  }, []);

  const parsed = parseSchoolYear(yearText);
  const unchanged = current && !parsed.error
    && current.startYear === parsed.startYear && current.semester === semester;

  const handleSave = async () => {
    if (parsed.error) { setMessage({ type: 'error', text: parsed.error }); return; }
    const startYear = parsed.startYear;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveAcademicTerm({ startYear, semester, uid: currentUser?.uid });
      setCurrent(saved);
      setMessage({ type: 'success', text: `Current term set to S.Y. ${saved.schoolYear}, ${saved.semesterLabel}.` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Could not save: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="sv-shell">
        <Navbar title="School Year & Semester" />

        <div className="p-4 sv-page">
          <p className="mb-4" style={{ color: '#555' }}>
            Set the school year and semester the school is currently in. It shows at the top of
            every page for admins and teachers.
          </p>

          {loading ? (
            <CardSkeleton height={160} />
          ) : (
            <div className="row g-3">
              {/* Current term */}
              <div className="col-lg-5">
                <div className="card border-0 shadow-sm rounded-4 h-100 sv-fade-up">
                  <div className="card-body p-4">
                    <p className="small fw-semibold mb-3" style={{ color: '#00838A' }}>
                      <i className="bi bi-calendar-check-fill me-2"></i>Current Term
                    </p>
                    {current ? (
                      <>
                        <h3 className="fw-bold mb-1" style={{ color: '#00838A' }}>S.Y. {current.schoolYear}</h3>
                        <p className="fs-5 mb-3" style={{ color: '#333' }}>{current.semesterLabel}</p>
                        {current.updatedAt && (
                          <p className="small mb-0" style={{ color: '#666' }}>
                            Last changed {current.updatedAt.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="p-3 rounded-3" style={{ backgroundColor: '#fff8e1', border: '1px solid #ffe082' }}>
                        <p className="mb-0 small" style={{ color: '#78550a' }}>
                          <i className="bi bi-exclamation-triangle-fill me-1"></i>
                          No school year has been set yet. Choose one on the right and save.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Edit */}
              <div className="col-lg-7">
                <div className="card border-0 shadow-sm rounded-4 h-100 sv-fade-up" style={{ animationDelay: '80ms' }}>
                  <div className="card-body p-4">
                    <p className="small fw-semibold mb-3" style={{ color: '#00838A' }}>
                      <i className="bi bi-pencil-square me-2"></i>Change Term
                    </p>

                    <div className="mb-3">
                      <label className="form-label fw-medium small" htmlFor="sv-school-year">School Year</label>
                      <div className="input-group">
                        <span className="input-group-text bg-white rounded-start-3" style={{ color: '#00838A' }}>S.Y.</span>
                        <input
                          id="sv-school-year"
                          type="text"
                          inputMode="numeric"
                          maxLength={11}
                          className={`form-control rounded-end-3 ${yearText && parsed.error ? 'is-invalid' : ''}`}
                          placeholder="e.g. 2026-2027"
                          value={yearText}
                          onChange={(e) => { setYearText(e.target.value); setMessage(null); }}
                          onBlur={() => { if (!parsed.error) setYearText(schoolYearFor(parsed.startYear)); }}
                          disabled={saving}
                        />
                      </div>
                      {yearText && parsed.error ? (
                        <div className="small mt-1" style={{ color: '#c62828' }}>{parsed.error}</div>
                      ) : (
                        <div className="mt-1" style={{ fontSize: 11, color: '#666' }}>
                          Type the start year and end year, e.g. 2026-2027. Typing just 2026 also works.
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="form-label fw-medium small d-block">Semester</label>
                      <div className="d-flex gap-2 flex-wrap" role="radiogroup" aria-label="Semester">
                        {SEMESTERS.map((s) => {
                          const active = semester === s.value;
                          return (
                            <button
                              key={s.value}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              className="btn rounded-3 fw-medium flex-fill"
                              style={active
                                ? { backgroundColor: '#00838A', color: '#fff', border: '1px solid #00838A' }
                                : { backgroundColor: '#fff', color: '#00838A', border: '1px solid #b2dfdb' }}
                              onClick={() => { setSemester(s.value); setMessage(null); }}
                              disabled={saving}
                            >
                              {active && <i className="bi bi-check-circle-fill me-2"></i>}
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {message && (
                      <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'} py-2 small rounded-3 mb-3`}>
                        <i className={`bi ${message.type === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle'} me-1`}></i>
                        {message.text}
                      </div>
                    )}

                    <button
                      className="btn rounded-3 fw-medium text-white"
                      style={{ backgroundColor: '#00838A' }}
                      onClick={handleSave}
                      disabled={saving || unchanged || !!parsed.error}
                    >
                      {saving
                        ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                        : <><i className="bi bi-save me-2"></i>Save Term</>}
                    </button>
                    {unchanged && <span className="small ms-3" style={{ color: '#666' }}>This is already the current term.</span>}
                  </div>
                </div>
              </div>

              {/* End of school year */}
              <div className="col-12">
                <div className="card border-0 shadow-sm rounded-4 sv-fade-up" style={{ animationDelay: '160ms', borderLeft: '4px solid #6A1B9A' }}>
                  <div className="card-body p-4 d-flex flex-wrap align-items-center gap-3">
                    <div className="flex-fill" style={{ minWidth: 260 }}>
                      <p className="small fw-semibold mb-1" style={{ color: '#6A1B9A' }}>
                        <i className="bi bi-mortarboard-fill me-2"></i>End of School Year
                      </p>
                      <p className="small mb-0" style={{ color: '#555' }}>
                        When the school year is over, move students up a grade, mark Grade 6 finishers as completed,
                        and start the next school year — all in one step. You review every student before anything changes.
                      </p>
                    </div>
                    <button
                      className="btn rounded-3 fw-medium text-white"
                      style={{ backgroundColor: '#6A1B9A' }}
                      onClick={() => setShowWizard(true)}
                    >
                      <i className="bi bi-calendar-plus me-2"></i>
                      Start S.Y. {schoolYearFor((current?.startYear ?? guessStartYear() - 1) + 1)}…
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showWizard && (
            <NewSchoolYearWizard
              currentTerm={current}
              onClose={() => setShowWizard(false)}
              onDone={() => { refresh(); setMessage(null); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
