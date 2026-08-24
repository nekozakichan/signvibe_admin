import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
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
      // Students (active only)
      const studentSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      const students = studentSnap.docs.map((d) => d.data()).filter((s) => s.status !== 'archived');

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

      setTotalStudents(students.length);
      setLessonsPublished(publishedLessons.length);

      if (students.length > 0) {
        const totalLessonsCount = publishedLessons.length || 1;
        const completionPct = students.reduce(
          (sum, s) => sum + Math.min(100, ((s.lessons_completed || 0) / totalLessonsCount) * 100),
          0
        ) / students.length;
        setAvgCompletion(Math.round(completionPct));
        setAvgPoints(Math.round(students.reduce((sum, s) => sum + (s.total_points || 0), 0) / students.length));
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

      setLoading(false);
    };
    fetchData();
  }, []);

  const stats = [
    { label: 'Total Students', value: totalStudents, icon: 'bi-people-fill', color: '#00838A' },
    { label: 'Lessons Published', value: lessonsPublished, icon: 'bi-collection-fill', color: '#1565C0' },
    { label: 'Avg. Completion', value: `${avgCompletion}%`, icon: 'bi-graph-up-arrow', color: '#2E7D32' },
    { label: 'Avg. Points / Student', value: avgPoints, icon: 'bi-star-fill', color: '#6A1B9A' },
  ];

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
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
      <div style={{ marginLeft: '250px', width: '100%', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <Navbar title="Teacher Dashboard" />

        <div className="p-4">
          <p className="mb-4" style={{ color: '#555' }}>
            Welcome back, <strong>{currentUser?.full_name}</strong>. Here's your class overview.
          </p>

          {loading ? (
            <div className="text-center py-5"><div className="spinner-border" style={{ color: '#00838A' }}></div></div>
          ) : (
            <>
              {/* Stats */}
              <div className="row g-3 mb-4">
                {stats.map((stat, i) => (
                  <div key={i} className="col-md-3 col-sm-6">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                      <div className="card-body d-flex align-items-center gap-3">
                        <div
                          className="rounded-3 d-flex align-items-center justify-content-center"
                          style={{ width: 52, height: 52, backgroundColor: `${stat.color}18` }}
                        >
                          <i className={`bi ${stat.icon} fs-4`} style={{ color: stat.color }}></i>
                        </div>
                        <div>
                          <p className="small mb-0" style={{ color: '#555' }}>{stat.label}</p>
                          <h3 className="fw-bold mb-0" style={{ color: stat.color }}>
                            {stat.value}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body p-4">
                  <h6 className="fw-semibold mb-1">Published Lessons per Module</h6>
                  <p className="small mb-4" style={{ color: '#555' }}>
                    How many lessons you've published in each module
                  </p>
                  {chartData.labels.length > 0 ? (
                    <Bar data={chartData} options={chartOptions} height={80} />
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
