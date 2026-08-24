import { useEffect, useState } from 'react';
import { db } from '../../api/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

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
      <div
        style={{
          marginLeft: '250px',
          width: '100%',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Navbar title="Admin Dashboard" />

        <div className="p-4">
          <p className="mb-4" style={{ color: '#555' }}>
            Welcome, Admin. Here's your system overview.
          </p>

          <div className="row g-3 mb-4">
            {loading ? (
              <div className="col-12 text-center py-4">
                <div className="spinner-border" style={{ color: '#00838A' }}></div>
              </div>
            ) : (
              stats.map((stat, i) => (
                <div key={i} className="col-md-3 col-sm-6">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center"
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
                      <div>
                        <p className="small mb-0" style={{ color: '#555' }}>{stat.label}</p>
                        <h3 className="fw-bold mb-0" style={{ color: stat.color }}>
                          {stat.value}
                        </h3>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: 52, height: 52, backgroundColor: '#00838A18' }}>
                <i className="bi bi-mortarboard-fill fs-4" style={{ color: '#00838A' }}></i>
              </div>
              <div>
                <p className="small mb-0" style={{ color: '#555' }}>Total Students (system-wide)</p>
                <h3 className="fw-bold mb-0" style={{ color: '#00838A' }}>{loading ? '—' : counts.students}</h3>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4">
              <h6 className="fw-semibold mb-3">Quick Actions</h6>
              <div className="d-flex gap-3 flex-wrap">
                <a
                  href="/admin/teachers"
                  className="btn text-white rounded-3"
                  style={{ backgroundColor: '#00838A' }}
                >
                  <i className="bi bi-person-plus-fill me-2"></i>
                  Create Teacher Account
                </a>

                <a
                  href="/admin/teachers"
                  className="btn btn-outline-secondary rounded-3"
                >
                  <i className="bi bi-people me-2"></i>
                  View All Teachers
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
