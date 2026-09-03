import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { userRole, logout, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Drawer state — only ever visible below the 992px breakpoint.
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes, so tapping a link
  // doesn't leave the overlay hanging around.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Escape closes it, and the page behind it shouldn't scroll while it's up.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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
    <>
      {/* Mobile / tablet drawer trigger */}
      <button
        type="button"
        className={`sv-drawer-toggle${open ? ' is-open' : ''}`}
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={open}
        aria-controls="sv-sidebar"
        onClick={() => setOpen((v) => !v)}
      >
        <i className={`bi ${open ? 'bi-x-lg' : 'bi-list'} fs-5`}></i>
      </button>

      {/* Dimmed backdrop, only while the drawer is open */}
      {open && (
        <button
          type="button"
          className="sv-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        id="sv-sidebar"
        className={`sv-sidebar d-flex flex-column ${open ? 'is-open' : ''}`}
      >
        {/* Logo */}
        <div className="p-4 border-bottom border-white border-opacity-25">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-hand-index-thumb-fill text-white fs-4 sv-brand-icon"></i>
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
              className="rounded-circle d-flex align-items-center justify-content-center sv-avatar"
              style={{
                width: 36,
                height: 36,
                backgroundColor: 'rgba(255,255,255,0.2)',
              }}
            >
              <i className="bi bi-person-fill text-white"></i>
            </div>
            <div className="text-truncate">
              <p
                className="text-white mb-0 fw-semibold text-truncate"
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
        <nav className="flex-grow-1 py-3 sv-stagger">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `sv-nav-link${isActive ? ' active' : ''}`
              }
            >
              <i className={`bi ${link.icon}`}></i>
              <span>{link.label}</span>
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
      </aside>
    </>
  );
}
