import { useEffect, useState } from 'react';
import { db } from '../../api/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import AnimatedNumber from '../../components/AnimatedNumber';
import { StatGridSkeleton } from '../../components/Skeletons';

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ total: 0, active: 0, deactivated: 0, archived: 0, students: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      const teacherSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'teacher')));
      const studentSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));

      const teachers = teacherSnap.docs.map((d) => d.data());
      const active = teachers.filter((t) => t.status === 'active').length;
      const archived = teachers.filter((t) => t.status === 'archived').length;
      const deactivated = teachers.filter((t) => t.status && t.status !== 'active' && t.status !== 'archived').length;

      setCounts({
        total: teachers.length,
        active,
        deactivated,
        archived,
        students: studentSnap.size,
      });
      setLoading(false);
    };
    fetchCounts();
  }, []);

  const stats = [
    { label: 'Total Teachers', value: counts.total, icon: 'bi-person-badge-fill', color: '#00838A' },
    { label: 'Active Teachers', value: counts.active, icon: 'bi-person-check-fill', color: '#1565C0' },
    { label: 'Deactivated', value: counts.deactivated, icon: 'bi-person-x-fill', color: '#D32F2F' },
    { label: 'Archived', value: counts.archived, icon: 'bi-archive-fill', color: '#d97706' },
  ];

  return (
    <div className="d-flex">
      <Sidebar />
      <div className="sv-shell">
        <Navbar title="Admin Dashboard" />

        <div className="p-4 sv-page">
          <p className="mb-4" style={{ color: '#555' }}>
            Welcome, Admin. Here's your system overview.
          </p>

          {loading ? (
            <StatGridSkeleton count={4} />
          ) : (
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
                        style={{
                          width: 52,
                          height: 52,
                          backgroundColor: `${stat.color}18`,
                        }}
                      >
                        <i
                          className={`bi ${stat.icon} fs-4`}
                          style={{ color: stat.color }}
                        ></i>
                      </div>
                      <div className="overflow-hidden">
                        <p className="small mb-0" style={{ color: '#555' }}>{stat.label}</p>
                        <h3 className="fw-bold mb-0 sv-stat-value" style={{ color: stat.color }}>
                          <AnimatedNumber value={stat.value} />
                        </h3>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            className="card border-0 shadow-sm rounded-4 mb-4 sv-stat sv-fade-up"
            style={{ color: '#00838A', animationDelay: '300ms' }}
          >
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-3 d-flex align-items-center justify-content-center sv-stat-icon" style={{ width: 52, height: 52, backgroundColor: '#00838A18' }}>
                <i className="bi bi-mortarboard-fill fs-4" style={{ color: '#00838A' }}></i>
              </div>
              <div className="overflow-hidden">
                <p className="small mb-0" style={{ color: '#555' }}>Total Students (system-wide)</p>
                <h3 className="fw-bold mb-0 sv-stat-value" style={{ color: '#00838A' }}>
                  {loading ? '—' : <AnimatedNumber value={counts.students} />}
                </h3>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4 sv-fade-up" style={{ animationDelay: '380ms' }}>
            <div className="card-body p-4">
              <h6 className="fw-semibold mb-3">Quick Actions</h6>
              <div className="d-flex gap-3 flex-wrap">
                {/* Client-side navigation — no full page reload, so the transition stays smooth */}
                <Link
                  to="/admin/teachers"
                  className="btn text-white rounded-3 sv-cta"
                  style={{ backgroundColor: '#00838A' }}
                >
                  <i className="bi bi-person-plus-fill me-2"></i>
                  Create Teacher Account
                </Link>

                <Link
                  to="/admin/teachers"
                  className="btn btn-outline-secondary rounded-3"
                >
                  <i className="bi bi-people me-2"></i>
                  View All Teachers
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
