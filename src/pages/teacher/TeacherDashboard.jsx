import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import AnimatedNumber from '../../components/AnimatedNumber';
import { StatGridSkeleton, CardSkeleton } from '../../components/Skeletons';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function TeacherDashboard() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [lessonsPublished, setLessonsPublished] = useState(0);
  const [avgCompletion, setAvgCompletion] = useState(0);
  const [avgPoints, setAvgPoints] = useState(0);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Students (active only)
        const studentSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
        const students = studentSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => s.status !== 'archived');

        // Lessons
        const lessonsSnap = await getDocs(collection(db, 'lessons'));
        const lessons = lessonsSnap.docs.map((d) => d.data());
        const publishedLessons = lessons.filter((l) => l.status === 'published');

        // Lessons grouped by module, for the chart
        const byModule = {};
        publishedLessons.forEach((l) => {
          const key = l.module_title || 'Uncategorized';
          byModule[key] = (byModule[key] || 0) + 1;
        });

        // Lessons-completed per student, from student_progress — the users doc's
        // lessons_completed / total_points fields are never written, so we derive
        // both from the real activity collections instead (same fix used on the
        // Class Overview, Reports, and Students List screens).
        const progressSnap = await getDocs(
          query(collection(db, 'student_progress'), where('is_completed', '==', true))
        );
        const lessonCounts = {};
        progressSnap.docs.forEach((d) => {
          const sid = d.data().student_id;
          if (sid) lessonCounts[sid] = (lessonCounts[sid] || 0) + 1;
        });

        // Total stars per student, from quiz_results.stars_earned.
        const quizSnap = await getDocs(collection(db, 'quiz_results'));
        const starCounts = {};
        quizSnap.docs.forEach((d) => {
          const { student_id, stars_earned } = d.data();
          if (student_id) starCounts[student_id] = (starCounts[student_id] || 0) + (stars_earned || 0);
        });

        setTotalStudents(students.length);
        setLessonsPublished(publishedLessons.length);

        if (students.length > 0) {
          const totalLessonsCount = publishedLessons.length || 1;
          const completionPct = students.reduce(
            (sum, s) => sum + Math.min(100, ((lessonCounts[s.id] || 0) / totalLessonsCount) * 100),
            0
          ) / students.length;
          setAvgCompletion(Math.round(completionPct));
          setAvgPoints(
            Math.round(students.reduce((sum, s) => sum + (starCounts[s.id] || 0), 0) / students.length)
          );
        }

        setChartData({
          labels: Object.keys(byModule),
          datasets: [
            {
              label: 'Published Lessons',
              data: Object.values(byModule),
              backgroundColor: '#00838A',
              borderRadius: 8,
            },
          ],
        });
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = [
    { label: 'Total Students', value: totalStudents, icon: 'bi-people-fill', color: '#00838A' },
    { label: 'Lessons Published', value: lessonsPublished, icon: 'bi-collection-fill', color: '#1565C0' },
    { label: 'Avg. Completion', value: avgCompletion, suffix: '%', icon: 'bi-graph-up-arrow', color: '#2E7D32' },
    { label: 'Avg. Stars / Student', value: avgPoints, icon: 'bi-star-fill', color: '#6A1B9A' },
  ];

  const chartOptions = {
    responsive: true,
    // Let the chart fill its container so it reflows on any screen size.
    maintainAspectRatio: false,
    animation: { duration: 900, easing: 'easeOutQuart' },
    animations: {
      y: { from: 0 },
    },
    transitions: {
      active: { animation: { duration: 200 } },
    },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: 'rgba(6,34,37,.92)',
        padding: 12,
        cornerRadius: 10,
        displayColors: false,
        titleFont: { weight: '600' },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: '#f0f0f0' },
      },
      x: { grid: { display: false } },
    },
  };

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="sv-shell">
        <Navbar title="Teacher Dashboard" />

        <div className="p-4 sv-page">
          <p className="mb-4" style={{ color: '#555' }}>
            Welcome back, <strong>{currentUser?.full_name}</strong>. Here's your class overview.
          </p>

          {loading ? (
            <>
              <StatGridSkeleton count={4} />
              <CardSkeleton height={240} />
            </>
          ) : (
            <>
              {/* Stats */}
              <div className="row g-3 mb-4 sv-stagger">
                {stats.map((stat, i) => (
                  <div key={i} className="col-xl-3 col-md-6">
                    <div
                      className="card border-0 shadow-sm rounded-4 h-100 sv-stat"
                      style={{ color: stat.color }}
                    >
                      <div className="card-body d-flex align-items-center gap-3">
                        <div
                          className="rounded-3 d-flex align-items-center justify-content-center sv-stat-icon"
                          style={{ width: 52, height: 52, backgroundColor: `${stat.color}18` }}
                        >
                          <i className={`bi ${stat.icon} fs-4`} style={{ color: stat.color }}></i>
                        </div>
                        <div className="overflow-hidden">
                          <p className="small mb-0" style={{ color: '#555' }}>{stat.label}</p>
                          <h3 className="fw-bold mb-0 sv-stat-value" style={{ color: stat.color }}>
                            <AnimatedNumber value={stat.value} suffix={stat.suffix || ''} />
                          </h3>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="card border-0 shadow-sm rounded-4 sv-fade-up" style={{ animationDelay: '260ms' }}>
                <div className="card-body p-4">
                  <h6 className="fw-semibold mb-1">Published Lessons per Module</h6>
                  <p className="small mb-4" style={{ color: '#555' }}>
                    How many lessons you've published in each module
                  </p>
                  {chartData.labels.length > 0 ? (
                    <div style={{ height: 'clamp(220px, 34vh, 340px)' }}>
                      <Bar data={chartData} options={chartOptions} />
                    </div>
                  ) : (
                    <div className="text-center py-4" style={{ color: '#555' }}>
                      No lessons published yet. Head to Manage Modules to add your first one.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}