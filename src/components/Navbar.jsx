import { useEffect, useState } from 'react';

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
      {children && <div className="ms-auto d-flex align-items-center gap-2">{children}</div>}
    </div>
  );
}
