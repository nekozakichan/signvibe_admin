import { useState, useEffect, useMemo } from 'react';
import { db } from '../../api/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import Logo from '../../components/Logo';
import { ListSkeleton } from '../../components/Skeletons';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// completed_at may be a Firestore Timestamp, a plain ISO string, or missing.
function formatDate(value) {
  if (!value) return '—';
  const date = value.seconds
    ? new Date(value.seconds * 1000)
    : new Date(value);
  return isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function moduleLabel(moduleId) {
  return (moduleId || 'Unknown module').replace(/_/g, ' ');
}

// Wrap anything containing a comma or quote so names don't split the CSV.
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCSV(filename, headers, rows) {
  const csv = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [students, setStudents] = useState([]);
  const [lessonsCompletedMap, setLessonsCompletedMap] = useState({});
  const [quizResults, setQuizResults] = useState([]);
  const [totalLessons, setTotalLessons] = useState(0);
  const [loading, setLoading] = useState(true);
  const [quizFilter, setQuizFilter] = useState('all');

  useEffect(() => {
    const fetch = async () => {
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const snap = await getDocs(q);
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Lessons-completed per student, from student_progress.
      const progressSnap = await getDocs(
        query(collection(db, 'student_progress'), where('is_completed', '==', true))
      );
      const counts = {};
      progressSnap.docs.forEach((d) => {
        const studentId = d.data().student_id;
        counts[studentId] = (counts[studentId] || 0) + 1;
      });
      setLessonsCompletedMap(counts);

      // Every quiz attempt — drives the stars total, the per-student averages
      // and the Quiz Results breakdown below.
      const quizSnap = await getDocs(collection(db, 'quiz_results'));
      setQuizResults(quizSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Total published lessons — denominator for the progress bar and remarks.
      const lessonsSnap = await getDocs(
        query(collection(db, 'lessons'), where('status', '==', 'published'))
      );
      setTotalLessons(lessonsSnap.size);

      setLoading(false);
    };
    fetch();
  }, []);

  // ─── Derived data ──────────────────────────────────────────────────────────

  // One pass over the attempts: stars, count and average score per student.
  const quizStats = useMemo(() => {
    const byStudent = {};
    quizResults.forEach((q) => {
      const id = q.student_id;
      if (!id) return;
      if (!byStudent[id]) byStudent[id] = { stars: 0, attempts: 0, percentTotal: 0, passed: 0 };
      byStudent[id].stars += q.stars_earned || 0;
      byStudent[id].attempts += 1;
      byStudent[id].percentTotal += q.percentage || 0;
      if (q.passed) byStudent[id].passed += 1;
    });
    return byStudent;
  }, [quizResults]);

  const statsFor = (id) =>
    quizStats[id] || { stars: 0, attempts: 0, percentTotal: 0, passed: 0 };

  const pointsFor = (id) => statsFor(id).stars;
  const quizzesTakenFor = (id) => statsFor(id).attempts;
  const avgScoreFor = (id) => {
    const { attempts, percentTotal } = statsFor(id);
    return attempts > 0 ? Math.round(percentTotal / attempts) : null;
  };

  const studentNames = useMemo(() => {
    const map = {};
    students.forEach((s) => { map[s.id] = s.full_name || 'Unknown student'; });
    return map;
  }, [students]);

  // Newest attempt first, optionally narrowed to one student.
  const visibleQuizzes = useMemo(() => {
    const rows = quizFilter === 'all'
      ? quizResults
      : quizResults.filter((q) => q.student_id === quizFilter);
    const time = (q) => (q.completed_at?.seconds ? q.completed_at.seconds * 1000 : new Date(q.completed_at || 0).getTime() || 0);
    return [...rows].sort((a, b) => time(b) - time(a));
  }, [quizResults, quizFilter]);

  const avgLessonsDone = students.length > 0
    ? Math.round(
        students.reduce((a, s) => a + (lessonsCompletedMap[s.id] || 0), 0) / students.length
      )
    : 0;

  const avgPoints = students.length > 0
    ? Math.round(students.reduce((a, s) => a + pointsFor(s.id), 0) / students.length)
    : 0;

  // Class average across every attempt, not an average of averages.
  const avgQuizScore = quizResults.length > 0
    ? Math.round(quizResults.reduce((a, q) => a + (q.percentage || 0), 0) / quizResults.length)
    : 0;

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handlePrint = () => window.print();

  const handleExportSummary = () => {
    downloadCSV(
      `signvibe_summary_${new Date().toLocaleDateString('en-CA')}.csv`,
      ['Name', 'Grade', 'Lessons Completed', 'Quizzes Taken', 'Avg. Score (%)', 'Total Stars'],
      students.map((s) => [
        s.full_name,
        s.grade_level,
        lessonsCompletedMap[s.id] || 0,
        quizzesTakenFor(s.id),
        avgScoreFor(s.id) ?? '',
        pointsFor(s.id),
      ])
    );
  };

  const handleExportQuizzes = () => {
    downloadCSV(
      `signvibe_quiz_scores_${new Date().toLocaleDateString('en-CA')}.csv`,
      ['Student', 'Module', 'Score', 'Total Questions', 'Percentage', 'Stars', 'Result', 'Date Taken'],
      visibleQuizzes.map((q) => [
        studentNames[q.student_id] || 'Unknown student',
        moduleLabel(q.module_id),
        q.score ?? '',
        q.total_questions ?? '',
        q.percentage ?? '',
        q.stars_earned ?? 0,
        q.passed ? 'Passed' : 'Not passed',
        formatDate(q.completed_at),
      ])
    );
  };

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="sv-shell">
        <Navbar title="Reports" />

        <div className="p-4 sv-page">
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
              <h6 className="fw-semibold mb-0">Student Performance Report</h6>
              <small className="text-muted">
                Generated: {new Date().toLocaleDateString('en-PH', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </small>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <button
                className="btn btn-outline-secondary rounded-3"
                onClick={handleExportSummary}
              >
                <i className="bi bi-filetype-csv me-2"></i>
                Export Summary
              </button>
              <button
                className="btn btn-outline-secondary rounded-3"
                onClick={handleExportQuizzes}
                disabled={visibleQuizzes.length === 0}
              >
                <i className="bi bi-filetype-csv me-2"></i>
                Export Quiz Scores
              </button>
              <button
                className="btn text-white rounded-3"
                style={{ backgroundColor: '#00838A' }}
                onClick={handlePrint}
              >
                <i className="bi bi-printer-fill me-2"></i>
                Print Report
              </button>
            </div>
          </div>

          <div
            className="card border-0 shadow-sm rounded-4 mb-4 p-4"
            style={{ borderLeft: '4px solid #00838A' }}
          >
            <div className="d-flex align-items-center gap-3">
              <Logo size={56} />
              <div>
                <h5 className="fw-bold mb-0" style={{ color: '#00838A' }}>
                  SignVibe — Student Progress Report
                </h5>
                <p className="text-muted small mb-0">
                  Urdaneta City SPED Center · Academic Year 2024–2025
                </p>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4 sv-stagger">
            {[
              { label: 'Total Students', value: students.length, icon: 'bi-people-fill', color: '#00838A' },
              { label: 'Quizzes Taken', value: quizResults.length, icon: 'bi-pencil-square', color: '#6A1B9A' },
              { label: 'Avg. Quiz Score', value: `${avgQuizScore}%`, icon: 'bi-percent', color: '#2E7D32' },
              { label: 'Avg. Stars', value: avgPoints, icon: 'bi-star-fill', color: '#F57F17' },
              { label: 'Avg. Lessons Done', value: avgLessonsDone, icon: 'bi-book-fill', color: '#1565C0' },
            ].map((s, i) => (
              <div key={i} className="col-xl col-md-4 col-sm-6">
                <div className="card border-0 shadow-sm rounded-4 h-100 sv-stat" style={{ color: s.color }}>
                  <div className="card-body d-flex align-items-center gap-3">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center sv-stat-icon"
                      style={{ width: 48, height: 48, backgroundColor: `${s.color}18`, flexShrink: 0 }}
                    >
                      <i className={`bi ${s.icon} fs-5`} style={{ color: s.color }}></i>
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-muted small mb-0">{s.label}</p>
                      <h4 className="fw-bold mb-0 sv-stat-value" style={{ color: s.color }}>{s.value}</h4>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Per-student summary ─────────────────────────────────────── */}
          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-body p-0">
              {loading ? (
                <div className="p-3"><ListSkeleton rows={6} /></div>
              ) : (
                <div className="table-responsive">
                  <table className="table mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-4 py-3">#</th>
                        <th>Student Name</th>
                        <th>Grade</th>
                        <th>Lessons Completed</th>
                        <th>Quizzes Taken</th>
                        <th>Avg. Score</th>
                        <th>Total Stars</th>
                        <th className="pe-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center py-5 text-muted">
                            No student data available
                          </td>
                        </tr>
                      ) : (
                        [...students]
                          .sort((a, b) => pointsFor(b.id) - pointsFor(a.id))
                          .map((s, i) => {
                            const done = lessonsCompletedMap[s.id] || 0;
                            const percent = totalLessons > 0 ? (done / totalLessons) * 100 : 0;
                            const avgScore = avgScoreFor(s.id);
                            const remarks =
                              percent >= 80
                                ? { label: 'Excellent', color: 'success' }
                                : percent >= 50
                                ? { label: 'Good', color: 'primary' }
                                : percent >= 20
                                ? { label: 'Needs Improvement', color: 'warning' }
                                : { label: 'Just Started', color: 'secondary' };

                            return (
                              <tr key={s.id}>
                                <td className="ps-4 text-muted small">{i + 1}</td>
                                <td className="fw-medium">{s.full_name}</td>
                                <td className="text-muted small">{s.grade_level}</td>
                                <td>
                                  <div className="d-flex align-items-center gap-2">
                                    <div
                                      className="progress flex-grow-1 rounded-pill"
                                      style={{ height: 6, maxWidth: 80 }}
                                    >
                                      <div
                                        className="progress-bar"
                                        style={{
                                          width: `${Math.min(percent, 100)}%`,
                                          backgroundColor: '#00838A',
                                        }}
                                      />
                                    </div>
                                    <span className="small text-muted">{done}</span>
                                  </div>
                                </td>
                                <td className="text-muted small">{quizzesTakenFor(s.id)}</td>
                                <td className="fw-semibold" style={{ color: '#2E7D32' }}>
                                  {avgScore === null ? <span className="text-muted fw-normal">—</span> : `${avgScore}%`}
                                </td>
                                <td className="fw-bold" style={{ color: '#F57F17' }}>
                                  {pointsFor(s.id)}
                                </td>
                                <td className="pe-4">
                                  <span className={`badge bg-${remarks.color} bg-opacity-10 text-${remarks.color} rounded-pill px-3`}>
                                    {remarks.label}
                                  </span>
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

          {/* ─── Every quiz attempt ──────────────────────────────────────── */}
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4 pb-0">
              <div className="d-flex justify-content-between align-items-end flex-wrap gap-2 mb-3">
                <div>
                  <h6 className="fw-semibold mb-1">Quiz Results</h6>
                  <p className="text-muted small mb-0">
                    Every quiz taken, with the score the student earned
                  </p>
                </div>
                {students.length > 0 && (
                  <select
                    className="form-select form-select-sm rounded-3"
                    style={{ maxWidth: 260 }}
                    value={quizFilter}
                    onChange={(e) => setQuizFilter(e.target.value)}
                    aria-label="Filter quiz results by student"
                  >
                    <option value="all">All students ({quizResults.length})</option>
                    {[...students]
                      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({quizzesTakenFor(s.id)})
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </div>

            <div className="card-body p-0">
              {loading ? (
                <div className="p-3"><ListSkeleton rows={5} /></div>
              ) : visibleQuizzes.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-pencil-square fs-1 d-block mb-2 opacity-25"></i>
                  {quizResults.length === 0
                    ? 'No quizzes have been taken yet'
                    : 'This student has not taken any quiz yet'}
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-4 py-3">Student</th>
                        <th>Module</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Stars</th>
                        <th>Result</th>
                        <th className="pe-4">Date Taken</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleQuizzes.map((q) => (
                        <tr key={q.id}>
                          <td className="ps-4 fw-medium">
                            {studentNames[q.student_id] || (
                              <span className="text-muted fw-normal">Unknown student</span>
                            )}
                          </td>
                          <td className="text-capitalize">{moduleLabel(q.module_id)}</td>
                          <td className="text-muted small">
                            {q.score ?? '—'} / {q.total_questions ?? '—'}
                          </td>
                          <td className="fw-semibold" style={{ color: '#00838A' }}>
                            {q.percentage ?? 0}%
                          </td>
                          <td className="fw-semibold" style={{ color: '#F57F17' }}>
                            {'⭐'.repeat(q.stars_earned || 0) || '—'}
                          </td>
                          <td>
                            <span
                              className={`badge rounded-pill ${
                                q.passed
                                  ? 'bg-success bg-opacity-10 text-success'
                                  : 'bg-warning bg-opacity-10 text-warning'
                              } px-3`}
                            >
                              {q.passed ? 'Passed' : 'Not passed'}
                            </span>
                          </td>
                          <td className="pe-4 text-muted small">{formatDate(q.completed_at)}</td>
                        </tr>
                      ))}
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
