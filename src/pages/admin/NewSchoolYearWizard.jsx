import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../api/firebase';
import { apiFetch } from '../../config/api';
import { buildFullName } from '../../utils/name';
import { schoolYearFor } from '../../config/academicTerm';

// ─── Start New School Year ────────────────────────────────────────────────────
// Step 1: review every active student and choose what happens to them
//         (move up a grade / stay / completed Grade 6).
// Step 2: confirm, then the backend applies it all and switches the term.
// Step 3: result summary.

const OPTIONS_BY_GRADE = (grade) =>
  grade >= 6
    ? [
        { value: 'complete', label: 'Completed Grade 6 (archive)' },
        { value: 'retain', label: 'Stay in Grade 6' },
      ]
    : [
        { value: 'promote', label: `Move up to Grade ${grade + 1}` },
        { value: 'retain', label: `Stay in Grade ${grade}` },
      ];

const defaultAction = (grade) => (grade >= 6 ? 'complete' : 'promote');

export default function NewSchoolYearWizard({ currentTerm, onClose, onDone }) {
  const nextStart = (currentTerm?.startYear ?? new Date().getFullYear() - 1) + 1;

  const [step, setStep] = useState('review'); // review | confirm | done
  const [students, setStudents] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => s.status !== 'archived')
          .map((s) => ({ ...s, grade: parseInt(s.grade_level, 10), name: s.full_name || buildFullName(s) }))
          .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));
        setStudents(list);
        setDecisions(Object.fromEntries(list.map((s) => [s.id, defaultAction(s.grade)])));
      } catch (err) {
        setError('Could not load students: ' + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const badGrade = students.filter((s) => !(s.grade >= 1 && s.grade <= 6));

  const byGrade = useMemo(() => {
    const groups = {};
    students.forEach((s) => { (groups[s.grade] ||= []).push(s); });
    return Object.entries(groups).map(([g, list]) => ({ grade: Number(g), list }));
  }, [students]);

  const counts = useMemo(() => {
    const c = { promote: 0, retain: 0, complete: 0 };
    Object.values(decisions).forEach((a) => { c[a] += 1; });
    return c;
  }, [decisions]);

  const setAllInGrade = (grade, action) =>
    setDecisions((prev) => {
      const next = { ...prev };
      students.filter((s) => s.grade === grade).forEach((s) => { next[s.id] = action; });
      return next;
    });

  const handleStart = async () => {
    setRunning(true);
    setError('');
    try {
      const res = await apiFetch('/api/school-year/start', {
        method: 'POST',
        body: JSON.stringify({
          startYear: nextStart,
          decisions: students.map((s) => ({ uid: s.id, action: decisions[s.id] })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Something went wrong.');
      setResult(data);
      setStep('done');
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const Stat = ({ value, label, color }) => (
    <div className="flex-fill text-center p-2 rounded-3" style={{ backgroundColor: `${color}12`, border: `1px solid ${color}40` }}>
      <div className="fw-bold fs-4" style={{ color }}>{value}</div>
      <div className="small" style={{ color: '#555' }}>{label}</div>
    </div>
  );

  // Rendered straight into <body>: the page content animates in with a
  // transform, and a transformed ancestor would trap this fixed-position
  // overlay inside the page area (and under the top bar).
  return createPortal(
    <>
      <div onClick={running ? undefined : onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Start new school year"
        style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'calc(100% - 32px)', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', borderRadius: 16, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
      >
        {/* Header */}
        <div className="d-flex justify-content-between align-items-start p-4 pb-3 border-bottom">
          <div>
            <h5 className="fw-bold mb-1" style={{ color: '#00838A' }}>
              <i className="bi bi-calendar-plus-fill me-2"></i>Start S.Y. {schoolYearFor(nextStart)}
            </h5>
            <p className="small mb-0" style={{ color: '#555' }}>
              {currentTerm ? <>Ending S.Y. {currentTerm.schoolYear}. </> : null}
              {step === 'review' && 'Choose what happens to each student. Defaults: everyone moves up a grade; Grade 6 completes.'}
              {step === 'confirm' && 'Check the summary, then confirm.'}
              {step === 'done' && 'All done.'}
            </p>
          </div>
          {!running && <button className="btn-close" onClick={onClose} aria-label="Close"></button>}
        </div>

        {/* Body */}
        <div className="p-4" style={{ overflowY: 'auto' }}>
          {error && <div className="alert alert-danger py-2 small rounded-3"><i className="bi bi-exclamation-circle me-1"></i>{error}</div>}

          {loading && <div className="text-center py-5"><div className="spinner-border" style={{ color: '#00838A' }}></div></div>}

          {!loading && step === 'review' && (
            students.length === 0 ? (
              <p className="text-center py-4 mb-0" style={{ color: '#555' }}>There are no active students. The new school year will simply be set.</p>
            ) : (
              <>
                {badGrade.length > 0 && (
                  <div className="alert alert-warning small py-2 rounded-3">
                    <i className="bi bi-exclamation-triangle-fill me-1"></i>
                    {badGrade.length} student(s) have no valid grade level ({badGrade.map((s) => s.name).join(', ')}).
                    Fix or archive them in the Students List first.
                  </div>
                )}
                {byGrade.filter((g) => g.grade >= 1 && g.grade <= 6).map(({ grade, list }) => (
                  <section key={grade} className="mb-4">
                    <div className="d-flex align-items-center flex-wrap gap-2 mb-2 pb-2" style={{ borderBottom: '1px solid #e0eeee' }}>
                      <h6 className="fw-bold mb-0" style={{ color: '#00838A' }}>Grade {grade}</h6>
                      <span className="small" style={{ color: '#666' }}>{list.length} student{list.length === 1 ? '' : 's'}</span>
                      <div className="ms-auto d-flex gap-1 flex-wrap">
                        {OPTIONS_BY_GRADE(grade).map((o) => (
                          <button key={o.value} type="button" className="btn btn-sm btn-outline-secondary rounded-pill" style={{ fontSize: 12 }} onClick={() => setAllInGrade(grade, o.value)}>
                            All: {o.label.replace(' (archive)', '')}
                          </button>
                        ))}
                      </div>
                    </div>
                    {list.map((s) => {
                      const action = decisions[s.id];
                      const tone = action === 'retain' ? '#d97706' : action === 'complete' ? '#6A1B9A' : '#00838A';
                      return (
                        <div key={s.id} className="d-flex align-items-center gap-2 py-2 px-2 rounded-3 flex-wrap" style={{ backgroundColor: action === 'promote' ? 'transparent' : `${tone}0d` }}>
                          <span className="flex-fill fw-medium" style={{ minWidth: 160 }}>{s.name}</span>
                          <select
                            className="form-select form-select-sm rounded-3"
                            style={{ width: 'auto', minWidth: 220, color: tone, borderColor: `${tone}66` }}
                            value={action}
                            onChange={(e) => setDecisions((p) => ({ ...p, [s.id]: e.target.value }))}
                            aria-label={`What happens to ${s.name}`}
                          >
                            {OPTIONS_BY_GRADE(grade).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </section>
                ))}
              </>
            )
          )}

          {!loading && step === 'confirm' && (
            <>
              <div className="d-flex gap-2 mb-3 flex-wrap">
                <Stat value={counts.promote} label="move up a grade" color="#00838A" />
                <Stat value={counts.retain} label="stay in their grade" color="#d97706" />
                <Stat value={counts.complete} label="completed Grade 6" color="#6A1B9A" />
              </div>
              <ul className="small mb-3" style={{ color: '#444' }}>
                <li>The school year changes to <strong>S.Y. {schoolYearFor(nextStart)}, 1st Semester</strong>.</li>
                <li>Each student's grade for S.Y. {currentTerm?.schoolYear ?? 'this year'} is saved in their record before it changes.</li>
                {counts.complete > 0 && (
                  <li>The {counts.complete} Grade 6 finisher{counts.complete === 1 ? ' is' : 's are'} archived — login turned off, progress kept,
                    restorable anytime — and emailed a congratulations notice.</li>
                )}
                <li>Lessons, quiz results and stars are not deleted.</li>
              </ul>
              <div className="form-check p-3 rounded-3" style={{ backgroundColor: '#fff8e1', border: '1px solid #ffe082' }}>
                <input className="form-check-input ms-0 me-2" type="checkbox" id="sv-understood" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
                <label className="form-check-label small" htmlFor="sv-understood" style={{ color: '#78550a' }}>
                  I've checked the list. Change the students' grades and start S.Y. {schoolYearFor(nextStart)}.
                </label>
              </div>
            </>
          )}

          {step === 'done' && result && (
            <div className="text-center py-3">
              <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64, backgroundColor: '#e6f9f9' }}>
                <i className="bi bi-check-lg fs-2" style={{ color: '#00838A' }}></i>
              </div>
              <h5 className="fw-bold" style={{ color: '#00838A' }}>Welcome to S.Y. {result.schoolYear}</h5>
              <p className="small mb-3" style={{ color: '#555' }}>
                {result.promoted} moved up · {result.retained} stayed · {result.completed} completed Grade 6
              </p>
              {result.emailsFailed > 0 && (
                <div className="alert alert-warning small py-2 rounded-3 text-start">
                  {result.emailsFailed} completion email(s) could not be sent. The accounts were still archived.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="d-flex gap-2 p-4 pt-3 border-top">
          {step === 'review' && (
            <>
              <button className="btn btn-outline-secondary rounded-3" onClick={onClose}>Cancel</button>
              <button
                className="btn rounded-3 fw-medium text-white ms-auto"
                style={{ backgroundColor: '#00838A' }}
                onClick={() => { setError(''); setStep('confirm'); }}
                disabled={loading || badGrade.length > 0}
              >
                Review summary <i className="bi bi-arrow-right ms-1"></i>
              </button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <button className="btn btn-outline-secondary rounded-3" onClick={() => setStep('review')} disabled={running}>
                <i className="bi bi-arrow-left me-1"></i>Back
              </button>
              <button
                className="btn rounded-3 fw-medium text-white ms-auto"
                style={{ backgroundColor: '#00838A' }}
                onClick={handleStart}
                disabled={!understood || running}
              >
                {running
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Updating students…</>
                  : <><i className="bi bi-calendar-check me-2"></i>Start S.Y. {schoolYearFor(nextStart)}</>}
              </button>
            </>
          )}
          {step === 'done' && (
            <button className="btn rounded-3 fw-medium text-white ms-auto" style={{ backgroundColor: '#00838A' }} onClick={onClose}>Done</button>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
