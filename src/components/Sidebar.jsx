import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { userRole, logout, currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const adminLinks = [
    { to: '/admin/dashboard', icon: 'bi-speedometer2', label: 'Dashboard' },
    { to: '/admin/teachers', icon: 'bi-people-fill', label: 'Manage Teachers' },
  ];

  const teacherLinks = [
    { to: '/teacher/dashboard', icon: 'bi-speedometer2', label: 'Dashboard' },
    { to: '/teacher/students', icon: 'bi-people-fill', label: 'Students List' },
    { to: '/teacher/class-overview', icon: 'bi-bar-chart-fill', label: 'Class Overview' },
    { to: '/teacher/modules', icon: 'bi-collection-fill', label: 'Manage Modules' },
    { to: '/teacher/reports', icon: 'bi-file-earmark-bar-graph-fill', label: 'Reports' },
  ];

  const links = userRole === 'admin' ? adminLinks : teacherLinks;

  return (
    <div
      className="d-flex flex-column"
      style={{
        width: '250px',
        minHeight: '100vh',
        backgroundColor: '#00838A',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div className="p-4 border-bottom border-white border-opacity-25">
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-hand-index-thumb-fill text-white fs-4"></i>
          <span
            className="text-white fw-bold fs-5"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            SignVibe
          </span>
        </div>
        <small
          className="text-white text-opacity-75"
          style={{ fontSize: '11px' }}
        >
          {userRole === 'admin' ? 'Admin Panel' : 'Teacher Portal'}
        </small>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-bottom border-white border-opacity-25">
        <div className="d-flex align-items-center gap-2">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center"
            style={{
              width: 36,
              height: 36,
              backgroundColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <i className="bi bi-person-fill text-white"></i>
          </div>
          <div>
            <p
              className="text-white mb-0 fw-semibold"
              style={{ fontSize: '13px' }}
            >
              {currentUser?.full_name || 'User'}
            </p>
            <p
              className="mb-0 text-white text-opacity-75"
              style={{ fontSize: '11px', textTransform: 'capitalize' }}
            >
              {userRole}
            </p>
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-grow-1 py-3">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className="d-flex align-items-center gap-3 px-4 py-3 text-decoration-none"
            style={({ isActive }) =>
              isActive
                ? {
                    fontSize: '14px',
                    transition: 'all 0.2s',
                    backgroundColor: '#ffffff',
                    color: '#00838A',
                    fontWeight: 600,
                    borderRight: '4px solid #005f5f',
                  }
                : {
                    fontSize: '14px',
                    transition: 'all 0.2s',
                    color: 'rgba(255,255,255,0.85)',
                  }
            }
          >
            <i className={`bi ${link.icon}`}></i>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-top border-white border-opacity-25">
        <button
          onClick={handleLogout}
          className="btn btn-outline-light btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
        >
          <i className="bi bi-box-arrow-left"></i>
          Log Out
        </button>
      </div>
    </div>
  );
}