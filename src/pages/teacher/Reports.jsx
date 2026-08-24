import { useState, useEffect } from 'react';
import { db } from '../../api/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

export default function Reports() {
  const [students, setStudents] = useState([]);
  const [lessonsCompletedMap, setLessonsCompletedMap] = useState({});
  const [pointsMap, setPointsMap] = useState({});
  const [totalLessons, setTotalLessons] = useState(0);
  const [loading, setLoading] = useState(true);

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
      
      // Total stars per student, summed from quiz_results.stars_earned.
      const quizSnap = await getDocs(collection(db, 'quiz_results'));
      const stars = {};
      quizSnap.docs.forEach((d) => {
        const { student_id, stars_earned } = d.data();
        if (student_id) stars[student_id] = (stars[student_id] || 0) + (stars_earned || 0);
      });
      setPointsMap(stars);

      // Total published lessons — denominator for the progress bar and remarks.
      const lessonsSnap = await getDocs(
        query(collection(db, 'lessons'), where('status', '==', 'published'))
      );
      setTotalLessons(lessonsSnap.size);

      setLoading(false);
    };
    fetch();
  }, []);

  const pointsFor = (id) => pointsMap[id] || 0;

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    const headers = ['Name', 'Grade', 'Section', 'Lessons Completed', 'Total Stars'];
    const rows = students.map((s) => [
      s.full_name,
      s.grade_level,
      s.section,
      lessonsCompletedMap[s.id] || 0,
      pointsFor(s.id),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signvibe_report_${new Date().toLocaleDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const avgLessonsDone = students.length > 0
    ? Math.round(
        students.reduce((a, s) => a + (lessonsCompletedMap[s.id] || 0), 0) / students.length
      )
    : 0;

  const avgPoints = students.length > 0
    ? Math.round(students.reduce((a, s) => a + pointsFor(s.id), 0) / students.length)
    : 0;

  return (
    <div className="d-flex">
      <Sidebar />
      <div style={{ marginLeft: '250px', width: '100%', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <Navbar title="Reports" />

        <div className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h6 className="fw-semibold mb-0">Student Performance Report</h6>
              <small className="text-muted">
                Generated: {new Date().toLocaleDateString('en-PH', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </small>
            </div>
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-secondary rounded-3"
                onClick={handleExportCSV}
              >
                <i className="bi bi-filetype-csv me-2"></i>
                Export CSV
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
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: 52, height: 52, backgroundColor: '#00838A' }}
              >
                <i className="bi bi-hand-index-thumb-fill text-white fs-4"></i>
              </div>
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

          <div className="row g-3 mb-4">
            {[
              { label: 'Total Students', value: students.length, icon: 'bi-people-fill', color: '#00838A' },
              { label: 'Avg. Stars', value: avgPoints, icon: 'bi-star-fill', color: '#F57F17' },
              { label: 'Avg. Lessons Done', value: avgLessonsDone, icon: 'bi-book-fill', color: '#1565C0' },
            ].map((s, i) => (
              <div key={i} className="col-md-4">
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
                      <h4 className="fw-bold mb-0" style={{ color: s.color }}>{s.value}</h4>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-0">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border" style={{ color: '#00838A' }}></div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-4 py-3">#</th>
                        <th>Student Name</th>
                        <th>Grade</th>
                        <th>Section</th>
                        <th>Lessons Completed</th>
                        <th>Total Stars</th>
                        <th className="pe-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-5 text-muted">
                            No student data available
                          </td>
                        </tr>
                      ) : (
                        [...students]
                          .sort((a, b) => pointsFor(b.id) - pointsFor(a.id))
                          .map((s, i) => {
                            const done = lessonsCompletedMap[s.id] || 0;
                            const percent = totalLessons > 0 ? (done / totalLessons) * 100 : 0;
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
                                <td className="text-muted small">{s.section}</td>
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
        </div>
      </div>
    </div>
  );
}