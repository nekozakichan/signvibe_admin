import { useState, useEffect } from 'react';
import { db } from '../../api/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function ClassOverview() {
  const [students, setStudents] = useState([]);
  const [lessonsCompletedMap, setLessonsCompletedMap] = useState({});
  const [pointsMap, setPointsMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const snap = await getDocs(q);
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Lessons-completed count per student, from student_progress.
      const progressSnap = await getDocs(
        query(collection(db, 'student_progress'), where('is_completed', '==', true))
      );
      const counts = {};
      progressSnap.docs.forEach((d) => {
        const studentId = d.data().student_id;
        counts[studentId] = (counts[studentId] || 0) + 1;
      });
      setLessonsCompletedMap(counts);

      // Total stars per student, summed from quiz_results.stars_earned.
      const quizSnap = await getDocs(collection(db, 'quiz_results'));
      const stars = {};
      quizSnap.docs.forEach((d) => {
        const { student_id, stars_earned } = d.data();
        if (!student_id) return;
        stars[student_id] = (stars[student_id] || 0) + (stars_earned || 0);
      });
      setPointsMap(stars);

      setLoading(false);
    };
    fetch();
  }, []);

  const pointsFor = (id) => pointsMap[id] || 0;

  const chartData = {
    labels: students.map((s) => s.full_name?.split(' ')[0] || 'Student'),
    datasets: [
      {
        label: 'Total Stars',
        data: students.map((s) => pointsFor(s.id)),
        backgroundColor: '#00838A',
        borderRadius: 8,
      },
      {
        label: 'Lessons Completed',
        data: students.map((s) => lessonsCompletedMap[s.id] || 0),
        backgroundColor: '#1565C0',
        borderRadius: 8,
      },
    ],
  };

  const classAvgPoints = students.length > 0
    ? Math.round(students.reduce((a, s) => a + pointsFor(s.id), 0) / students.length)
    : 0;

  const topPerformer = [...students]
    .sort((a, b) => pointsFor(b.id) - pointsFor(a.id))[0]?.full_name?.split(' ')[0] || '—';

  return (
    <div className="d-flex">
      <Sidebar />
      <div style={{ marginLeft: '250px', width: '100%', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <Navbar title="Class Overview" />

        <div className="p-4">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border" style={{ color: '#00838A' }}></div>
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div className="row g-3 mb-4">
                {[
                  { label: 'Total Students', value: students.length, color: '#00838A', icon: 'bi-people-fill' },
                  { label: 'Class Avg. Stars', value: classAvgPoints, color: '#1565C0', icon: 'bi-star-fill' },
                  { label: 'Top Performer', value: topPerformer, color: '#F57F17', icon: 'bi-trophy-fill' },
                ].map((s, i) => (
                  <div key={i} className="col-md-4">
                    <div className="card border-0 shadow-sm rounded-4">
                      <div className="card-body d-flex align-items-center gap-3">
                        <div
                          className="rounded-3 d-flex align-items-center justify-content-center"
                          style={{ width: 52, height: 52, backgroundColor: `${s.color}18` }}
                        >
                          <i className={`bi ${s.icon} fs-4`} style={{ color: s.color }}></i>
                        </div>
                        <div>
                          <p className="text-muted small mb-0">{s.label}</p>
                          <h4 className="fw-bold mb-0" style={{ color: s.color }}>{s.value}</h4>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bar chart */}
              <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-body p-4">
                  <h6 className="fw-semibold mb-1">Student Performance Comparison</h6>
                  <p className="text-muted small mb-4">Stars and lessons completed per student</p>
                  {students.length > 0 ? (
                    <Bar
                      data={chartData}
                      options={{
                        responsive: true,
                        plugins: { legend: { position: 'bottom' } },
                        scales: {
                          y: { beginAtZero: true, grid: { color: '#f0f0f0' } },
                          x: { grid: { display: false } },
                        },
                      }}
                      height={60}
                    />
                  ) : (
                    <div className="text-center py-4 text-muted">No data yet</div>
                  )}
                </div>
              </div>

              {/* Leaderboard table */}
              <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body p-0">
                  <div className="px-4 py-3 border-bottom">
                    <h6 className="fw-semibold mb-0">Class Leaderboard</h6>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                      <thead className="table-light">
                        <tr>
                          <th className="ps-4 py-3">Rank</th>
                          <th>Student</th>
                          <th>Grade & Section</th>
                          <th>Lessons Done</th>
                          <th className="pe-4">Total Stars</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...students]
                          .sort((a, b) => pointsFor(b.id) - pointsFor(a.id))
                          .map((s, i) => (
                            <tr key={s.id}>
                              <td className="ps-4">
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                              </td>
                              <td className="fw-medium">{s.full_name}</td>
                              <td className="text-muted small">{s.grade_level} - {s.section}</td>
                              <td>
                                <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-3">
                                  {lessonsCompletedMap[s.id] || 0}
                                </span>
                              </td>
                              <td className="pe-4 fw-bold" style={{ color: '#F57F17' }}>
                                {pointsFor(s.id)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}