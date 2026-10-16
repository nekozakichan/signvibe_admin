import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { watchAcademicTerm } from '../config/academicTerm';

// The current school year & semester, shown on every page. Live, so it changes
// the moment the admin saves a new term.
function TermBadge() {
  const { userRole } = useAuth();
  const [term, setTerm] = useState(undefined); // undefined = still loading

  useEffect(() => watchAcademicTerm(setTerm), []);

  if (term === undefined) return null;

  if (!term) {
    // Only the admin can fix it, so only the admin is nagged about it.
    return userRole === 'admin' ? (
      <Link
        to="/admin/settings"
        className="badge rounded-pill text-decoration-none d-none d-md-inline-flex align-items-center gap-1"
        style={{ backgroundColor: '#fff8e1', color: '#78550a', border: '1px solid #ffe082', fontWeight: 500, fontSize: 12, padding: '6px 12px' }}
      >
        <i className="bi bi-exclamation-triangle-fill"></i>Set school year
      </Link>
    ) : null;
  }

  return (
    <span
      className="badge rounded-pill d-none d-md-inline-flex align-items-center gap-1"
      style={{ backgroundColor: '#00838A14', color: '#00696f', border: '1px solid #b2dfdb', fontWeight: 500, fontSize: 12, padding: '6px 12px' }}
      title="Current school year and semester"
    >
      <i className="bi bi-calendar3"></i>S.Y. {term.schoolYear} · {term.semesterLabel}
    </span>
  );
}

export default function Navbar({ title, children }) {
  const [stuck, setStuck] = useState(false);

  // Lift the bar with a shadow once the page scrolls under it.
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`sv-navbar${stuck ? ' is-stuck' : ''}`}>
      <h5 className="mb-0 fw-semibold text-dark text-truncate">{title}</h5>
      <div className="ms-auto d-flex align-items-center gap-2">
        <TermBadge />
        {children}
      </div>
    </div>
  );
}
