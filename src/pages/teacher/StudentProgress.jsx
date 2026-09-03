import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { db } from '../../api/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, CategoryScale,
  LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// mm:ss-ish formatter for durations expressed in whole seconds.
const fmtTime = (s) =>
  s == null ? '—' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

export default function StudentProgress() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [progress, setProgress] = useState([]);
  const [totalLessons, setTotalLessons] = useState(0);
  const [lessonMap, setLessonMap] = useState({});
  const [gameSessions, setGameSessions] = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [activeTab, setActiveTab] = useState('performance');
  const [gameMetric, setGameMetric] = useState('accuracy'); // 'accuracy' | 'time'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Student info
      const studentDoc = await getDoc(doc(db, 'users', studentId));
      if (studentDoc.exists()) setStudent(studentDoc.data());

      // Progress (completed-lesson docs for this student)
      const progressSnap = await getDocs(
        query(collection(db, 'student_progress'), where('student_id', '==', studentId))
      );
      setProgress(progressSnap.docs.map((d) => d.data()));

      // All lessons — lesson_id → title lookup + published count (completion
      // denominator) in one pass. A progress doc only exists once a lesson is
      // completed (see ProgressRepository on the Android side).
      const lessonsSnap = await getDocs(collection(db, 'lessons'));
      const map = {};
      let publishedCount = 0;
      lessonsSnap.docs.forEach((d) => {
        const data = d.data();
        map[d.id] = data.title || 'Untitled Lesson';
        if (data.status === 'published') publishedCount++;
      });
      setLessonMap(map);
      setTotalLessons(publishedCount);

      // Game sessions. No orderBy in the query on purpose — combining
      // where('student_id') with orderBy('played_at') would force a composite
      // index. We sort client-side below instead. Same result, no index.
      const gameSnap = await getDocs(
        query(collection(db, 'game_sessions'), where('student_id', '==', studentId))
      );
      setGameSessions(gameSnap.docs.map((d) => d.data()));

      // Quiz results (tracing quizzes) — real source for Average Quiz Score
      // and Total Stars (users.total_points is never written).
      const quizSnap = await getDocs(
        query(collection(db, 'quiz_results'), where('student_id', '==', studentId))
      );
      setQuizResults(quizSnap.docs.map((d) => d.data()));

      setLoading(false);
    };
    fetchData();
  }, [studentId]);

  const completedCount = progress.filter((p) => p.is_completed).length;
  const totalCount = totalLessons;

  const avgScore =
    quizResults.length > 0
      ? Math.round(
          quizResults.reduce((a, q) => a + (q.percentage || 0), 0) / quizResults.length
        )
      : 0;

  const totalStars = quizResults.reduce((a, q) => a + (q.stars_earned || 0), 0);

  // ── Game sessions, oldest → newest (bars read left-to-right as a timeline) ──
  const sessionsSorted = [...gameSessions].sort((a, b) => {
    const ta = a.played_at?.seconds || 0;
    const tb = b.played_at?.seconds || 0;
    return ta - tb;
  });

  // Accuracy = correct matches (pairs) / total attempts (moves). Perfect = 100%.
  const accuracyFor = (g) => {
    const moves = g.moves || 0;
    const pairs = g.pairs || 0;
    if (moves <= 0 || pairs <= 0) return 0;
    return Math.round((pairs / moves) * 100);
  };

  const accuracies = sessionsSorted.map(accuracyFor);
  const avgAccuracy = accuracies.length
    ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
    : 0;
  const bestAccuracy = accuracies.length ? Math.max(...accuracies) : 0;
  const latestAcc = accuracies.length ? accuracies[accuracies.length - 1] : 0;
  const prevAcc = accuracies.length >= 2 ? accuracies[accuracies.length - 2] : null;
  const accTrend =
    prevAcc === null ? null : latestAcc > prevAcc ? 'up' : latestAcc < prevAcc ? 'down' : 'flat';

  // ── Completion time. Only sessions that carry duration_ms (i.e. rounds
  // played on the updated app) appear here; older docs are skipped, keeping
  // their original session index so "Game 3" means the same round in both views.
  const timedPoints = sessionsSorted
    .map((g, i) => ({
      idx: i,
      sec: g.duration_ms && g.duration_ms > 0 ? Math.round(g.duration_ms / 1000) : null,
      g,
    }))
    .filter((p) => p.sec != null);

  const timedSecs = timedPoints.map((p) => p.sec);
  const avgTime = timedSecs.length
    ? Math.round(timedSecs.reduce((a, b) => a + b, 0) / timedSecs.length)
    : null;
  const fastestTime = timedSecs.length ? Math.min(...timedSecs) : null; // best = smallest
  const latestTime = timedSecs.length ? timedSecs[timedSecs.length - 1] : null;
  const prevTime = timedSecs.length >= 2 ? timedSecs[timedSecs.length - 2] : null;
  // For time, DOWN is improvement (faster). Direction is inverted vs accuracy.
  const timeTrend =
    prevTime === null ? null : latestTime < prevTime ? 'faster' : latestTime > prevTime ? 'slower' : 'flat';

  const showingTime = gameMetric === 'time';

  const doughnutData = {
    labels: ['Completed', 'Remaining'],
    datasets: [{
      data: [completedCount, Math.max(totalCount - completedCount, 0)],
      backgroundColor: ['#00838A', '#E0E0E0'],
      borderWidth: 0,
    }],
  };

  const barData = showingTime
    ? {
        labels: timedPoints.map((p) => `Game ${p.idx + 1}`),
        datasets: [{
          label: 'Seconds',
          data: timedSecs,
          backgroundColor: '#00838A',
          borderRadius: 6,
        }],
      }
    : {
        labels: sessionsSorted.map((_, i) => `Game ${i + 1}`),
        datasets: [{
          label: 'Accuracy',
          data: accuracies,
          backgroundColor: '#00838A',
          borderRadius: 6,
        }],
      };

  const barOptions = showingTime
    ? {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const p = timedPoints[ctx.dataIndex] || {};
                const g = p.g || {};
                return [
                  `Time: ${fmtTime(p.sec)}`,
                  `Accuracy: ${accuracyFor(g)}%`,
                  `Mistakes: ${g.mistakes ?? 0}`,
                  `Difficulty: ${g.difficulty ?? '—'}`,
                ];
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => `${v}s` },
            grid: { color: '#f0f0f0' },
          },
          x: { grid: { display: false } },
        },
      }
    : {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const g = sessionsSorted[ctx.dataIndex] || {};
                return [
                  `Accuracy: ${accuracyFor(g)}%`,
                  `Mistakes: ${g.mistakes ?? 0}`,
                  `Tries: ${g.moves ?? 0} for ${g.pairs ?? 0} pairs`,
                  `Difficulty: ${g.difficulty ?? '—'}`,
                ];
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { callback: (v) => `${v}%` },
            grid: { color: '#f0f0f0' },
          },
          x: { grid: { display: false } },
        },
      };

  if (loading) {
    return (
      <div className="d-flex">
        <Sidebar />
        <div style={{ marginLeft: 'var(--sv-content-offset)', width: '100%' }} className="d-flex align-items-center justify-content-center min-vh-100">
          <div className="spinner-border" style={{ color: '#00838A' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="sv-shell">
        <Navbar title="Student Progress" />

        <div className="p-4 sv-page">
          {/* Back button + student name */}
          <div className="d-flex align-items-center gap-3 mb-4">
            <button
              className="btn btn-light rounded-3"
              onClick={() => navigate('/teacher/students')}
            >
              <i className="bi bi-arrow-left me-1"></i> Back
            </button>
            <div>
              <h6 className="fw-semibold mb-0">{student?.full_name}</h6>
              <small className="text-muted">
                {student?.grade_level} - {student?.section}
              </small>
            </div>
          </div>

          {/* Summary cards */}
          <div className="row g-3 mb-4">
            {[
              { label: 'Lessons Completed', value: `${completedCount}/${totalCount}`, icon: 'bi-book-fill', color: '#00838A' },
              { label: 'Average Quiz Score', value: `${avgScore}%`, icon: 'bi-patch-check-fill', color: '#1565C0' },
              { label: 'Games Played', value: gameSessions.length, icon: 'bi-controller', color: '#6A1B9A' },
              { label: 'Total Stars', value: `${totalStars} ⭐`, icon: 'bi-star-fill', color: '#F57F17' },
            ].map((s, i) => (
              <div key={i} className="col-md-3 col-sm-6">
                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-body d-flex align-items-center gap-3">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center"
                      style={{ width: 48, height: 48, backgroundColor: `${s.color}18` }}
                    >
                      <i className={`bi ${s.icon} fs-5`} style={{ color: s.color }}></i>
                    </div>
                    <div>
                      <p className="text-muted small mb-0">{s.label}</p>
                      <h5 className="fw-bold mb-0" style={{ color: s.color }}>{s.value}</h5>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <ul className="nav nav-pills mb-4 gap-2">
            {['performance', 'activity'].map((tab) => (
              <li key={tab} className="nav-item">
                <button
                  className={`nav-link rounded-3 text-capitalize ${activeTab === tab ? 'active' : 'text-muted'}`}
                  style={activeTab === tab ? { backgroundColor: '#00838A' } : {}}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              </li>
            ))}
          </ul>

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div className="row g-4">
              <div className="col-md-5">
                <div className="card border-0 shadow-sm rounded-4 h-100">
                  <div className="card-body p-4">
                    <h6 className="fw-semibold mb-1">Lesson Completion</h6>
                    <p className="text-muted small mb-3">Overall progress across all modules</p>
                    <Doughnut
                      data={doughnutData}
                      options={{
                        cutout: '70%',
                        plugins: { legend: { position: 'bottom' } },
                      }}
                    />
                    <div className="text-center mt-3">
                      <h4 className="fw-bold mb-0" style={{ color: '#00838A' }}>
                        {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
                      </h4>
                      <small className="text-muted">Overall Completion</small>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-7">
                <div className="card border-0 shadow-sm rounded-4 h-100">
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-start mb-1 flex-wrap gap-2">
                      <div>
                        <h6 className="fw-semibold mb-1">
                          {showingTime ? 'Completion Time' : 'Game Accuracy'}
                        </h6>
                        <p className="text-muted small mb-0">
                          {showingTime
                            ? 'Time to finish per session · faster is better · active play only'
                            : 'Match accuracy per session · higher is better'}
                        </p>
                      </div>

                      {/* Accuracy ⇄ Time toggle */}
                      {gameSessions.length > 0 && (
                        <div className="btn-group btn-group-sm" role="group">
                          <button
                            type="button"
                            className={`btn ${!showingTime ? 'btn-dark' : 'btn-outline-secondary'}`}
                            style={!showingTime ? { backgroundColor: '#00838A', borderColor: '#00838A' } : {}}
                            onClick={() => setGameMetric('accuracy')}
                          >
                            Accuracy
                          </button>
                          <button
                            type="button"
                            className={`btn ${showingTime ? 'btn-dark' : 'btn-outline-secondary'}`}
                            style={showingTime ? { backgroundColor: '#00838A', borderColor: '#00838A' } : {}}
                            onClick={() => setGameMetric('time')}
                          >
                            Time
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      {gameSessions.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                          <i className="bi bi-controller fs-1 d-block mb-2 opacity-25"></i>
                          No game sessions yet
                        </div>
                      ) : showingTime ? (
                        timedPoints.length === 0 ? (
                          <div className="text-center py-5 text-muted">
                            <i className="bi bi-stopwatch fs-1 d-block mb-2 opacity-25"></i>
                            No timed sessions yet — play a round on the updated app.
                          </div>
                        ) : (
                          <>
                            <div className="d-flex flex-wrap gap-3 mb-3 small">
                              <span className="text-muted">
                                Average <strong style={{ color: '#00838A' }}>{fmtTime(avgTime)}</strong>
                              </span>
                              <span className="text-muted">
                                Fastest <strong style={{ color: '#00838A' }}>{fmtTime(fastestTime)}</strong>
                              </span>
                              {timeTrend && (
                                <span className="text-muted">
                                  Latest{' '}
                                  {timeTrend === 'faster' && (
                                    <strong className="text-success">
                                      {fmtTime(latestTime)} (faster than {fmtTime(prevTime)})
                                    </strong>
                                  )}
                                  {timeTrend === 'slower' && (
                                    <strong className="text-warning">
                                      {fmtTime(latestTime)} (slower than {fmtTime(prevTime)})
                                    </strong>
                                  )}
                                  {timeTrend === 'flat' && (
                                    <strong className="text-muted">
                                      {fmtTime(latestTime)} (same as before)
                                    </strong>
                                  )}
                                </span>
                              )}
                            </div>
                            <Bar data={barData} options={barOptions} />
                          </>
                        )
                      ) : (
                        <>
                          <div className="d-flex flex-wrap gap-3 mb-3 small">
                            <span className="text-muted">
                              Average <strong style={{ color: '#00838A' }}>{avgAccuracy}%</strong>
                            </span>
                            <span className="text-muted">
                              Best <strong style={{ color: '#00838A' }}>{bestAccuracy}%</strong>
                            </span>
                            {accTrend && (
                              <span className="text-muted">
                                Latest{' '}
                                {accTrend === 'up' && (
                                  <strong className="text-success">▲ {latestAcc}% (up from {prevAcc}%)</strong>
                                )}
                                {accTrend === 'down' && (
                                  <strong className="text-warning">▼ {latestAcc}% (was {prevAcc}%)</strong>
                                )}
                                {accTrend === 'flat' && (
                                  <strong className="text-muted">— {latestAcc}% (steady)</strong>
                                )}
                              </span>
                            )}
                          </div>
                          <Bar data={barData} options={barOptions} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quiz Scores by Module */}
              <div className="col-12">
                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-body p-4">
                    <h6 className="fw-semibold mb-1">Quiz Scores by Module</h6>
                    <p className="text-muted small mb-3">Score for each module quiz taken</p>
                    {quizResults.length === 0 ? (
                      <div className="text-center py-4 text-muted">
                        <i className="bi bi-pencil-square fs-1 d-block mb-2 opacity-25"></i>
                        No quizzes taken yet
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-hover mb-0 align-middle">
                          <thead className="table-light">
                            <tr>
                              <th className="ps-3 py-2">Module</th>
                              <th>Score</th>
                              <th>Percentage</th>
                              <th>Stars</th>
                              <th>Result</th>
                              <th className="pe-3">Date Taken</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...quizResults]
                              .sort((a, b) => (a.module_id || '').localeCompare(b.module_id || ''))
                              .map((q, i) => (
                                <tr key={i}>
                                  <td className="ps-3 fw-medium text-capitalize">
                                    {(q.module_id || '').replace(/_/g, ' ')}
                                  </td>
                                  <td>{q.score ?? '—'} / {q.total_questions ?? '—'}</td>
                                  <td className="fw-semibold" style={{ color: '#00838A' }}>
                                    {q.percentage ?? 0}%
                                  </td>
                                  <td className="fw-semibold" style={{ color: '#F57F17' }}>
                                    {'⭐'.repeat(q.stars_earned || 0) || '—'}
                                  </td>
                                  <td>
                                    <span
                                      className={`badge rounded-pill ${
                                        q.passed ? 'bg-success' : 'bg-warning text-dark'
                                      }`}
                                    >
                                      {q.passed ? 'Passed' : 'Not passed'}
                                    </span>
                                  </td>
                                  <td className="pe-3 text-muted small">
                                    {q.completed_at
                                      ? new Date(q.completed_at.seconds * 1000).toLocaleDateString()
                                      : '—'}
                                  </td>
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
          )}

          {/* Activity Tab - Score column removed */}
          {activeTab === 'activity' && (
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-4 py-3">Lesson</th>
                        <th>Status</th>
                        <th className="pe-4">Completed At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progress.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="text-center py-5 text-muted">
                            <i className="bi bi-journal-x fs-1 d-block mb-2 opacity-25"></i>
                            No activity recorded yet
                          </td>
                        </tr>
                      ) : (
                        progress.map((p, i) => (
                          <tr key={i}>
                            <td className="ps-4 fw-medium">
                              {lessonMap[p.lesson_id] || `Lesson ${p.lesson_id}`}
                            </td>
                            <td>
                              <span
                                className={`badge rounded-pill ${
                                  p.is_completed ? 'bg-success' : 'bg-warning text-dark'
                                }`}
                              >
                                {p.is_completed ? 'Completed' : 'In Progress'}
                              </span>
                            </td>
                            <td className="pe-4 text-muted small">
                              {p.completed_at
                                ? new Date(p.completed_at.seconds * 1000).toLocaleDateString()
                                : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}